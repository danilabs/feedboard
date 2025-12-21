package main

import (
	_ "embed"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

//go:embed index.html
var indexHTML []byte

// Server handles HTTP requests and WebSocket connections
type Server struct {
	hub      *Hub
	mtxClient *MediaMTXClient
	capture  *CaptureManager
	router   *mux.Router
	upgrader websocket.Upgrader
}

// NewServer creates a new HTTP server
func NewServer(hub *Hub, mtxClient *MediaMTXClient, capture *CaptureManager) *Server {
	s := &Server{
		hub:       hub,
		mtxClient: mtxClient,
		capture:   capture,
		router:    mux.NewRouter(),
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for development
			},
		},
	}

	s.setupRoutes()
	return s
}

func (s *Server) setupRoutes() {
	// API routes
	api := s.router.PathPrefix("/api").Subrouter()
	api.HandleFunc("/streams", s.handleListStreams).Methods("GET")
	api.HandleFunc("/streams/{name}/thumbnail", s.handleGetThumbnail).Methods("GET")
	api.HandleFunc("/streams/{name}/thumbnail.jpg", s.handleGetThumbnail).Methods("GET")
	api.HandleFunc("/streams/{name}/refresh", s.handleRefreshThumbnail).Methods("POST")

	// MediaMTX webhook endpoints
	api.HandleFunc("/hooks/ready", s.handleHookReady).Methods("POST", "GET")
	api.HandleFunc("/hooks/notready", s.handleHookNotReady).Methods("POST", "GET")

	// WebSocket
	s.router.HandleFunc("/ws", s.handleWebSocket)

	// Health check
	s.router.HandleFunc("/health", s.handleHealth).Methods("GET")

	// Serve index.html at root
	s.router.HandleFunc("/", s.handleIndex).Methods("GET")

	// CORS middleware
	s.router.Use(corsMiddleware)
}

// Handler returns the HTTP handler
func (s *Server) Handler() http.Handler {
	return s.router
}

// StreamResponse represents a stream in the API response
type StreamResponse struct {
	Name         string  `json:"name"`
	Ready        bool    `json:"ready"`
	HasThumbnail bool    `json:"hasThumbnail"`
	ThumbnailURL string  `json:"thumbnailUrl,omitempty"`
	Source       *string `json:"source,omitempty"`
	Tracks       []string `json:"tracks,omitempty"`
}

func (s *Server) handleListStreams(w http.ResponseWriter, r *http.Request) {
	streams := s.mtxClient.GetStreams()

	response := make([]StreamResponse, 0, len(streams))
	for _, stream := range streams {
		var sourceType *string
		if stream.Source != nil {
			sourceType = &stream.Source.Type
		}

		sr := StreamResponse{
			Name:         stream.Name,
			Ready:        stream.Ready,
			HasThumbnail: s.capture.GetThumbnail(stream.Name) != nil,
			Tracks:       stream.Tracks,
			Source:       sourceType,
		}
		if sr.HasThumbnail {
			sr.ThumbnailURL = "/api/streams/" + stream.Name + "/thumbnail.jpg"
		}
		response = append(response, sr)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *Server) handleGetThumbnail(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	name := vars["name"]

	thumb := s.capture.GetThumbnail(name)
	if thumb == nil {
		// Try to start capture if stream exists
		if stream, ok := s.mtxClient.GetStream(name); ok && stream.Ready {
			s.capture.StartCapture(name)
		}
		http.Error(w, "Thumbnail not available", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("X-Thumbnail-Width", string(rune(thumb.Width)))
	w.Header().Set("X-Thumbnail-Height", string(rune(thumb.Height)))
	w.Header().Set("X-Thumbnail-Timestamp", thumb.Timestamp.Format(time.RFC3339))
	w.Write(thumb.Data)
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	s.hub.ServeClient(conn)
}

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write(indexHTML)
}

func (s *Server) handleRefreshThumbnail(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	name := vars["name"]

	// Trigger immediate capture
	if stream, ok := s.mtxClient.GetStream(name); ok && stream.Ready {
		s.capture.StartCapture(name)
		w.WriteHeader(http.StatusAccepted)
		w.Write([]byte(`{"status":"refreshing"}`))
	} else {
		http.Error(w, "Stream not found or not ready", http.StatusNotFound)
	}
}

// handleHookReady is called by MediaMTX when a stream becomes ready
// Configure in mediamtx.yml: runOnReady: curl -X POST http://localhost:8090/api/hooks/ready?path=$MTX_PATH
func (s *Server) handleHookReady(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		path = r.URL.Query().Get("name")
	}
	if path == "" {
		http.Error(w, "path parameter required", http.StatusBadRequest)
		return
	}

	log.Printf("Hook: stream ready - %s", path)
	s.capture.StartCapture(path)
	w.WriteHeader(http.StatusOK)
}

// handleHookNotReady is called by MediaMTX when a stream stops
// Configure in mediamtx.yml: runOnNotReady: curl -X POST http://localhost:8090/api/hooks/notready?path=$MTX_PATH
func (s *Server) handleHookNotReady(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		path = r.URL.Query().Get("name")
	}
	if path == "" {
		http.Error(w, "path parameter required", http.StatusBadRequest)
		return
	}

	log.Printf("Hook: stream not ready - %s", path)
	s.capture.StopCapture(path)
	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	status := map[string]interface{}{
		"status":    "ok",
		"streams":   len(s.mtxClient.GetStreams()),
		"clients":   s.hub.ClientCount(),
		"timestamp": time.Now().Format(time.RFC3339),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
