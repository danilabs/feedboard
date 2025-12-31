package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sync"
	"time"
)

// MediaMTXPath represents a stream path from the MediaMTX API
type MediaMTXPath struct {
	Name          string            `json:"name"`
	ConfName      string            `json:"confName"`
	Source        *MediaMTXSource   `json:"source"`
	Ready         bool              `json:"ready"`
	ReadyTime     *string           `json:"readyTime"`
	Tracks        []string          `json:"tracks"`
	BytesReceived int64             `json:"bytesReceived"`
	BytesSent     int64             `json:"bytesSent"`
	Readers       []MediaMTXReader  `json:"readers"`
}

// MediaMTXSource represents the source of a stream
type MediaMTXSource struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

// MediaMTXReader represents a reader connected to a stream
type MediaMTXReader struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

// MediaMTXPathList is the API response for listing paths
type MediaMTXPathList struct {
	ItemCount int            `json:"itemCount"`
	PageCount int            `json:"pageCount"`
	Items     []MediaMTXPath `json:"items"`
}

// StreamEvent represents a change in stream state
type StreamEvent struct {
	Type   string // "added", "removed", "ready", "not_ready"
	Stream MediaMTXPath
}

// MediaMTXClient polls the MediaMTX API and tracks stream state
type MediaMTXClient struct {
	apiURL       string
	rtspURL      string
	pollInterval time.Duration
	httpClient   *http.Client

	mu      sync.RWMutex
	streams map[string]MediaMTXPath

	eventCh chan StreamEvent
	stopCh  chan struct{}
}

// NewMediaMTXClient creates a new MediaMTX API client
func NewMediaMTXClient(apiURL, rtspURL string, pollInterval time.Duration) *MediaMTXClient {
	return &MediaMTXClient{
		apiURL:       apiURL,
		rtspURL:      rtspURL,
		pollInterval: pollInterval,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		streams: make(map[string]MediaMTXPath),
		eventCh: make(chan StreamEvent, 100),
		stopCh:  make(chan struct{}),
	}
}

// Events returns the channel for stream events
func (c *MediaMTXClient) Events() <-chan StreamEvent {
	return c.eventCh
}

// ListPaths fetches the current list of paths from MediaMTX
func (c *MediaMTXClient) ListPaths() ([]MediaMTXPath, error) {
	resp, err := c.httpClient.Get(c.apiURL + "/v3/paths/list")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch paths: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	var list MediaMTXPathList
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return list.Items, nil
}

// GetStreams returns a copy of the current stream map
func (c *MediaMTXClient) GetStreams() map[string]MediaMTXPath {
	c.mu.RLock()
	defer c.mu.RUnlock()

	result := make(map[string]MediaMTXPath, len(c.streams))
	for k, v := range c.streams {
		result[k] = v
	}
	return result
}

// GetStream returns a specific stream by name
func (c *MediaMTXClient) GetStream(name string) (MediaMTXPath, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	stream, ok := c.streams[name]
	return stream, ok
}

// RTSPUrl returns the RTSP URL for a given stream path
func (c *MediaMTXClient) RTSPUrl(path string) string {
	return c.rtspURL + "/" + url.PathEscape(path)
}

// Start begins polling the MediaMTX API
func (c *MediaMTXClient) Start() {
	go c.pollLoop()
}

// Stop stops polling
func (c *MediaMTXClient) Stop() {
	close(c.stopCh)
}

func (c *MediaMTXClient) pollLoop() {
	// Initial poll
	c.poll()

	ticker := time.NewTicker(c.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			c.poll()
		case <-c.stopCh:
			return
		}
	}
}

func (c *MediaMTXClient) poll() {
	paths, err := c.ListPaths()
	if err != nil {
		log.Printf("Failed to poll MediaMTX: %v", err)
		return
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	// Track current paths
	currentPaths := make(map[string]bool)
	for _, path := range paths {
		currentPaths[path.Name] = true

		existing, exists := c.streams[path.Name]
		if !exists {
			// New stream
			c.streams[path.Name] = path
			c.sendEvent(StreamEvent{Type: "added", Stream: path})
			if path.Ready {
				c.sendEvent(StreamEvent{Type: "ready", Stream: path})
			}
		} else {
			// Update existing
			c.streams[path.Name] = path
			// Check for ready state change
			if !existing.Ready && path.Ready {
				c.sendEvent(StreamEvent{Type: "ready", Stream: path})
			} else if existing.Ready && !path.Ready {
				c.sendEvent(StreamEvent{Type: "not_ready", Stream: path})
			}
		}
	}

	// Check for removed streams
	for name, stream := range c.streams {
		if !currentPaths[name] {
			delete(c.streams, name)
			c.sendEvent(StreamEvent{Type: "removed", Stream: stream})
		}
	}
}

func (c *MediaMTXClient) sendEvent(event StreamEvent) {
	select {
	case c.eventCh <- event:
	default:
		log.Printf("Event channel full, dropping event: %s %s", event.Type, event.Stream.Name)
	}
}
