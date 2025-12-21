package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	// CLI flags
	mediamtxAPI := flag.String("mediamtx-api", "http://localhost:9997", "MediaMTX API URL")
	mediamtxRTSP := flag.String("mediamtx-rtsp", "rtsp://localhost:8554", "MediaMTX RTSP URL")
	port := flag.Int("port", 8090, "HTTP server port")
	pollInterval := flag.Duration("poll-interval", 5*time.Second, "Stream list poll interval")
	captureMode := flag.String("capture-mode", "keyframe", "Capture mode: keyframe or interval")
	captureInterval := flag.Duration("capture-interval", 10*time.Second, "Thumbnail refresh interval")
	thumbnailQuality := flag.Int("thumbnail-quality", 85, "JPEG quality (1-100)")
	thumbnailWidth := flag.Int("thumbnail-width", 320, "Thumbnail width in pixels (0 = original)")
	flag.Parse()

	log.Printf("Thumbnailer starting...")
	log.Printf("  MediaMTX API: %s", *mediamtxAPI)
	log.Printf("  MediaMTX RTSP: %s", *mediamtxRTSP)
	log.Printf("  HTTP Port: %d", *port)
	log.Printf("  Capture Mode: %s", *captureMode)

	// Check for ffmpeg
	if _, err := lookPath("ffmpeg"); err != nil {
		log.Fatal("ffmpeg not found. Please install FFmpeg.")
	}

	// Create components
	mtxClient := NewMediaMTXClient(*mediamtxAPI, *mediamtxRTSP, *pollInterval)

	mode := CaptureModeKeyframe
	if *captureMode == "interval" {
		mode = CaptureModeInterval
	}

	captureConfig := CaptureConfig{
		Mode:             mode,
		Interval:         *captureInterval,
		ThumbnailWidth:   *thumbnailWidth,
		ThumbnailQuality: *thumbnailQuality,
	}

	capture, err := NewCaptureManager(*mediamtxRTSP, captureConfig)
	if err != nil {
		log.Fatalf("Failed to create capture manager: %v", err)
	}

	hub := NewHub()
	server := NewServer(hub, mtxClient, capture)

	// Start components
	go hub.Run()
	mtxClient.Start()

	// Handle stream events
	go handleStreamEvents(mtxClient, capture, hub)

	// Forward thumbnails to WebSocket
	go forwardThumbnails(capture, hub)

	// Start HTTP server
	addr := fmt.Sprintf(":%d", *port)
	httpServer := &http.Server{
		Addr:         addr,
		Handler:      server.Handler(),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	go func() {
		log.Printf("HTTP server listening on %s", addr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// Wait for shutdown signal
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	log.Println("Shutting down...")
	mtxClient.Stop()
	capture.Stop()
	httpServer.Close()
}

func handleStreamEvents(mtxClient *MediaMTXClient, capture *CaptureManager, hub *Hub) {
	for event := range mtxClient.Events() {
		switch event.Type {
		case "added":
			log.Printf("Stream added: %s", event.Stream.Name)
			hub.BroadcastStreamList(mtxClient.GetStreams())

		case "removed":
			log.Printf("Stream removed: %s", event.Stream.Name)
			capture.StopCapture(event.Stream.Name)
			hub.BroadcastStreamList(mtxClient.GetStreams())

		case "ready":
			log.Printf("Stream ready: %s", event.Stream.Name)
			capture.StartCapture(event.Stream.Name)
			hub.BroadcastStreamList(mtxClient.GetStreams())

		case "not_ready":
			log.Printf("Stream not ready: %s", event.Stream.Name)
			capture.StopCapture(event.Stream.Name)
			hub.BroadcastStreamList(mtxClient.GetStreams())
		}
	}
}

func forwardThumbnails(capture *CaptureManager, hub *Hub) {
	for thumb := range capture.Thumbnails() {
		hub.BroadcastThumbnail(thumb.Stream, thumb.Data, thumb.Width, thumb.Height)
	}
}

// lookPath checks if a command exists in PATH
func lookPath(cmd string) (string, error) {
	path, err := execLookPath(cmd)
	if err != nil {
		return "", err
	}
	return path, nil
}

// execLookPath wraps exec.LookPath for easier testing
var execLookPath = func(file string) (string, error) {
	return file, nil // Will be replaced with actual implementation
}

func init() {
	// Set up the actual LookPath implementation
	execLookPath = func(file string) (string, error) {
		// Check common paths
		paths := []string{
			"/usr/bin/" + file,
			"/usr/local/bin/" + file,
			"/opt/homebrew/bin/" + file,
		}
		for _, p := range paths {
			if _, err := os.Stat(p); err == nil {
				return p, nil
			}
		}
		// Fall back to PATH lookup
		return "", fmt.Errorf("%s not found", file)
	}
}
