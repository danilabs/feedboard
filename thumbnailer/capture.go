package main

import (
	"bytes"
	"context"
	"fmt"
	"image"
	_ "image/jpeg"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

// CaptureMode determines how often thumbnails are captured
type CaptureMode string

const (
	CaptureModeKeyframe CaptureMode = "keyframe"
	CaptureModeInterval CaptureMode = "interval"
)

// CaptureConfig holds capture settings
type CaptureConfig struct {
	Mode             CaptureMode
	Interval         time.Duration
	ThumbnailWidth   int
	ThumbnailQuality int
}

// Thumbnail represents a captured thumbnail
type Thumbnail struct {
	Stream    string
	Data      []byte
	Width     int
	Height    int
	Timestamp time.Time
}

// StreamCapture manages FFmpeg capture for a single stream
type StreamCapture struct {
	streamName string
	rtspURL    string
	config     CaptureConfig
	tempDir    string

	ctx    context.Context
	cancel context.CancelFunc

	mu      sync.RWMutex
	latest  *Thumbnail
	running bool
}

// CaptureManager manages captures for multiple streams
type CaptureManager struct {
	config   CaptureConfig
	rtspBase string
	tempDir  string

	mu       sync.RWMutex
	captures map[string]*StreamCapture

	thumbnailCh chan Thumbnail
	stopCh      chan struct{}
}

// NewCaptureManager creates a new capture manager
func NewCaptureManager(rtspBase string, config CaptureConfig) (*CaptureManager, error) {
	tempDir, err := os.MkdirTemp("", "thumbnailer-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp dir: %w", err)
	}

	return &CaptureManager{
		config:      config,
		rtspBase:    rtspBase,
		tempDir:     tempDir,
		captures:    make(map[string]*StreamCapture),
		thumbnailCh: make(chan Thumbnail, 100),
		stopCh:      make(chan struct{}),
	}, nil
}

// Thumbnails returns the channel for new thumbnails
func (m *CaptureManager) Thumbnails() <-chan Thumbnail {
	return m.thumbnailCh
}

// StartCapture starts capturing thumbnails for a stream
func (m *CaptureManager) StartCapture(streamName string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.captures[streamName]; exists {
		return nil // Already capturing
	}

	rtspURL := m.rtspBase + "/" + streamName
	streamDir := filepath.Join(m.tempDir, streamName)
	if err := os.MkdirAll(streamDir, 0755); err != nil {
		return fmt.Errorf("failed to create stream dir: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	capture := &StreamCapture{
		streamName: streamName,
		rtspURL:    rtspURL,
		config:     m.config,
		tempDir:    streamDir,
		ctx:        ctx,
		cancel:     cancel,
	}

	m.captures[streamName] = capture
	go m.runCapture(capture)

	log.Printf("Started capture for stream: %s", streamName)
	return nil
}

// StopCapture stops capturing for a stream
func (m *CaptureManager) StopCapture(streamName string) {
	m.mu.Lock()
	capture, exists := m.captures[streamName]
	if exists {
		delete(m.captures, streamName)
	}
	m.mu.Unlock()

	if exists {
		capture.cancel()
		// Clean up temp dir
		os.RemoveAll(capture.tempDir)
		log.Printf("Stopped capture for stream: %s", streamName)
	}
}

// GetThumbnail returns the latest thumbnail for a stream
func (m *CaptureManager) GetThumbnail(streamName string) *Thumbnail {
	m.mu.RLock()
	capture, exists := m.captures[streamName]
	m.mu.RUnlock()

	if !exists {
		return nil
	}

	capture.mu.RLock()
	defer capture.mu.RUnlock()
	return capture.latest
}

// Stop stops all captures
func (m *CaptureManager) Stop() {
	close(m.stopCh)

	m.mu.Lock()
	for name := range m.captures {
		m.mu.Unlock()
		m.StopCapture(name)
		m.mu.Lock()
	}
	m.mu.Unlock()

	os.RemoveAll(m.tempDir)
}

func (m *CaptureManager) runCapture(capture *StreamCapture) {
	// Determine interval
	interval := capture.config.Interval
	if interval < time.Second {
		interval = 10 * time.Second
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Initial capture
	m.captureFrame(capture)

	for {
		select {
		case <-capture.ctx.Done():
			return
		case <-ticker.C:
			m.captureFrame(capture)
		}
	}
}

func (m *CaptureManager) captureFrame(capture *StreamCapture) {
	outputFile := filepath.Join(capture.tempDir, "thumb.jpg")

	// Build FFmpeg command
	width := capture.config.ThumbnailWidth
	if width == 0 {
		width = 320
	}
	quality := capture.config.ThumbnailQuality
	if quality == 0 {
		quality = 85
	}
	// FFmpeg quality is 2-31, lower is better. Map 0-100 to 31-2
	ffmpegQuality := 31 - (quality * 29 / 100)

	// Scale filter to resize
	scaleFilter := fmt.Sprintf("scale=%d:-1", width)

	args := []string{
		"-y",                    // Overwrite output
		"-rtsp_transport", "tcp", // Use TCP for RTSP
		"-i", capture.rtspURL,
		"-frames:v", "1",        // Capture only 1 frame
		"-vf", scaleFilter,
		"-q:v", fmt.Sprintf("%d", ffmpegQuality),
		"-update", "1",          // Update single file
		outputFile,
	}

	ctx, cancel := context.WithTimeout(capture.ctx, 10*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	cmd.Stderr = nil // Suppress FFmpeg output
	cmd.Stdout = nil

	if err := cmd.Run(); err != nil {
		// Don't log every error - stream might be temporarily unavailable
		return
	}

	// Read the captured frame
	data, err := os.ReadFile(outputFile)
	if err != nil {
		return
	}

	// Get dimensions
	width, height := getImageDimensions(data)

	thumb := Thumbnail{
		Stream:    capture.streamName,
		Data:      data,
		Width:     width,
		Height:    height,
		Timestamp: time.Now(),
	}

	// Update latest
	capture.mu.Lock()
	capture.latest = &thumb
	capture.mu.Unlock()

	// Send to channel
	select {
	case m.thumbnailCh <- thumb:
	default:
		// Channel full, skip
	}
}

func getImageDimensions(data []byte) (int, int) {
	reader := bytes.NewReader(data)
	config, _, err := image.DecodeConfig(reader)
	if err != nil {
		return 0, 0
	}
	return config.Width, config.Height
}
