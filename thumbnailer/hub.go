package main

import (
	"encoding/base64"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// ThumbnailMessage is sent over WebSocket when a thumbnail updates
type ThumbnailMessage struct {
	Type      string `json:"type"`      // "thumbnail"
	Stream    string `json:"stream"`    // stream name
	Timestamp int64  `json:"timestamp"` // unix timestamp ms
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	Data      string `json:"data"` // base64 encoded JPEG
}

// StreamListMessage is sent when streams change
type StreamListMessage struct {
	Type    string         `json:"type"` // "streams"
	Streams []StreamInfo   `json:"streams"`
}

// StreamInfo is basic info about a stream
type StreamInfo struct {
	Name   string   `json:"name"`
	Ready  bool     `json:"ready"`
	Source string   `json:"source,omitempty"`
	Tracks []string `json:"tracks,omitempty"`
}

// Client represents a WebSocket client connection
type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte

	mu          sync.RWMutex
	subscribed  map[string]bool // streams this client is subscribed to (empty = all)
}

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

// NewHub creates a new Hub
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("Client connected, total: %d", len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("Client disconnected, total: %d", len(h.clients))

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					// Client send buffer full, close it
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// BroadcastThumbnail sends a thumbnail to all connected clients
func (h *Hub) BroadcastThumbnail(stream string, data []byte, width, height int) {
	msg := ThumbnailMessage{
		Type:      "thumbnail",
		Stream:    stream,
		Timestamp: time.Now().UnixMilli(),
		Width:     width,
		Height:    height,
		Data:      base64.StdEncoding.EncodeToString(data),
	}

	jsonData, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Failed to marshal thumbnail message: %v", err)
		return
	}

	h.broadcast <- jsonData
}

// BroadcastStreamList sends the current stream list to all clients
func (h *Hub) BroadcastStreamList(streams map[string]MediaMTXPath) {
	infos := make([]StreamInfo, 0, len(streams))
	for _, s := range streams {
		info := StreamInfo{
			Name:   s.Name,
			Ready:  s.Ready,
			Tracks: s.Tracks,
		}
		if s.Source != nil {
			info.Source = s.Source.Type
		}
		infos = append(infos, info)
	}

	msg := StreamListMessage{
		Type:    "streams",
		Streams: infos,
	}

	jsonData, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Failed to marshal stream list: %v", err)
		return
	}

	h.broadcast <- jsonData
}

// ClientCount returns the number of connected clients
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// ServeClient handles a WebSocket connection
func (h *Hub) ServeClient(conn *websocket.Conn) {
	client := &Client{
		hub:        h,
		conn:       conn,
		send:       make(chan []byte, 256),
		subscribed: make(map[string]bool),
	}

	h.register <- client

	// Start write pump in goroutine
	go client.writePump()

	// Read pump (blocks until connection closes)
	client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(4096)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Handle subscription messages
		var cmd struct {
			Type    string   `json:"type"`
			Streams []string `json:"streams"`
		}
		if err := json.Unmarshal(message, &cmd); err == nil {
			if cmd.Type == "subscribe" {
				c.mu.Lock()
				c.subscribed = make(map[string]bool)
				for _, s := range cmd.Streams {
					c.subscribed[s] = true
				}
				c.mu.Unlock()
			}
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
