package main

import (
	"crypto/rand"
	"encoding/base64"
	"net"
	"path/filepath"
	"strings"
)

// isLocalhost checks if an IP address is localhost
func isLocalhost(ip string) bool {
	// Handle empty IP
	if ip == "" {
		return false
	}

	// Parse the IP
	parsed := net.ParseIP(ip)
	if parsed == nil {
		// Could be hostname or IP:port, try to extract IP
		host, _, err := net.SplitHostPort(ip)
		if err == nil {
			parsed = net.ParseIP(host)
		}
	}

	if parsed == nil {
		// Check for localhost hostname
		return ip == "localhost"
	}

	// Check for loopback addresses
	return parsed.IsLoopback()
}

// generateSecureToken generates a random alphanumeric token
func generateSecureToken(length int) string {
	b := make([]byte, length)
	rand.Read(b)
	// Use URL-safe base64 and trim to exact length
	token := base64.RawURLEncoding.EncodeToString(b)
	if len(token) > length {
		token = token[:length]
	}
	return token
}

// generateStreamKey generates a stream key with a type prefix
func generateStreamKey(keyType string) string {
	prefix := "sk_" // default for publish
	if keyType == "playback" {
		prefix = "pt_"
	}
	return prefix + generateSecureToken(24)
}

// matchPath checks if a path matches a pattern
// Supports:
//   - Exact match: "cam1" matches "cam1"
//   - Wildcard suffix: "studio/*" matches "studio/main", "studio/backup"
//   - Global wildcard: "*" matches everything
func matchPath(pattern, path string) bool {
	// Clean paths
	pattern = strings.Trim(pattern, "/")
	path = strings.Trim(path, "/")

	// Global wildcard
	if pattern == "*" {
		return true
	}

	// Exact match
	if pattern == path {
		return true
	}

	// Wildcard suffix (e.g., "studio/*")
	if strings.HasSuffix(pattern, "/*") {
		prefix := strings.TrimSuffix(pattern, "/*")
		return strings.HasPrefix(path, prefix+"/") || path == prefix
	}

	// Glob pattern match
	matched, _ := filepath.Match(pattern, path)
	return matched
}

// roleHasPermission checks if a role is allowed based on allowed roles string
func roleHasPermission(role, allowedRoles string) bool {
	if allowedRoles == "" || allowedRoles == "*" {
		return true
	}
	roles := strings.Split(allowedRoles, ",")
	for _, r := range roles {
		if strings.TrimSpace(r) == role {
			return true
		}
	}
	// Admin always has permission
	return role == "admin"
}

// canPublish checks if a role can publish
func canPublish(role string) bool {
	return role == "publisher" || role == "admin"
}

// canView checks if a role can view streams
func canView(role string) bool {
	return role == "viewer" || role == "publisher" || role == "admin"
}
