package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
)

// MediaMTXAuthRequest represents the auth request from MediaMTX
type MediaMTXAuthRequest struct {
	User     string `json:"user"`
	Password string `json:"password"`
	Token    string `json:"token"` // JWT or bearer token
	IP       string `json:"ip"`
	Action   string `json:"action"`   // publish, read, playback, api, metrics, pprof
	Path     string `json:"path"`
	Protocol string `json:"protocol"` // rtsp, rtmp, hls, webrtc, srt
	ID       string `json:"id"`
	Query    string `json:"query"`
}

// HookHandler handles MediaMTX authentication hooks
type HookHandler struct {
	db   *DB
	auth *AuthHandler
}

// NewHookHandler creates a new hook handler
func NewHookHandler(db *DB, auth *AuthHandler) *HookHandler {
	return &HookHandler{db: db, auth: auth}
}

// HandleAuth handles POST /auth/hook
// MediaMTX calls this endpoint before allowing publish or playback
func (h *HookHandler) HandleAuth(w http.ResponseWriter, r *http.Request) {
	var req MediaMTXAuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Hook: invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	log.Printf("Hook: action=%s path=%s protocol=%s ip=%s user=%s pass=%v token=%v query=%s",
		req.Action, req.Path, req.Protocol, req.IP, req.User, req.Password != "", req.Token != "", req.Query)

	// Allow thumbnailer service account (user=service for read actions)
	thumbnailerToken := os.Getenv("THUMBNAILER_TOKEN")
	if thumbnailerToken != "" && req.User == "service" && req.Password == thumbnailerToken && req.Action == "read" {
		log.Printf("Hook: allowing thumbnailer service account")
		w.WriteHeader(http.StatusOK)
		return
	}

	// Allow internal publisher service account (user=internal for publish actions)
	internalToken := os.Getenv("INTERNAL_PUBLISH_TOKEN")
	if internalToken != "" && req.User == "internal" && req.Password == internalToken && req.Action == "publish" {
		log.Printf("Hook: allowing internal publisher for path=%s", req.Path)
		w.WriteHeader(http.StatusOK)
		return
	}

	// Normalize action
	action := req.Action
	if action == "playback" || action == "read" {
		action = "read"
	}

	// Clean path
	path := strings.Trim(req.Path, "/")

	// Check if path is public (for read actions)
	if action == "read" {
		perm, _ := h.db.GetStreamPermission(path)
		if perm != nil && perm.IsPublic {
			log.Printf("Hook: allowing public read for path=%s", path)
			w.WriteHeader(http.StatusOK)
			return
		}
	}

	// Try to authenticate via different methods

	// 1. JWT in token field (passed via Authorization header or as password)
	if req.Token != "" {
		user := h.auth.validateToken(req.Token)
		if user != nil {
			if action == "publish" && !canPublish(user.Role) {
				log.Printf("Hook: user %s (role=%s) cannot publish", user.Username, user.Role)
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}
			if action == "read" && !canView(user.Role) {
				log.Printf("Hook: user %s (role=%s) cannot view", user.Username, user.Role)
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}
			log.Printf("Hook: authenticated via token field: user=%s role=%s", user.Username, user.Role)
			w.WriteHeader(http.StatusOK)
			return
		}

		// Try as stream key
		keyType := "publish"
		if action == "read" {
			keyType = "playback"
		}
		key, _ := h.db.ValidateStreamKey(req.Token, keyType, path, action)
		if key != nil {
			log.Printf("Hook: authenticated via token field as stream key: %s...", key.Key[:12])
			w.WriteHeader(http.StatusOK)
			return
		}
	}

	// 2. Stream key in password field (for OBS, etc.)
	if req.Password != "" {
		keyType := "publish"
		if action == "read" {
			keyType = "playback"
		}
		key, err := h.db.ValidateStreamKey(req.Password, keyType, path, action)
		if err != nil {
			log.Printf("Hook: stream key validation error: %v", err)
		}
		if key != nil {
			log.Printf("Hook: authenticated via stream key: %s...", key.Key[:12])
			w.WriteHeader(http.StatusOK)
			return
		}
	}

	// 3. Token/key in query string (?token=xxx or ?key=xxx) - for SRT, RTMP, etc.
	if req.Query != "" {
		token := extractQueryParam(req.Query, "token")
		if token == "" {
			token = extractQueryParam(req.Query, "key")
		}
		if token != "" {
			keyType := "publish"
			if action == "read" {
				keyType = "playback"
			}
			key, err := h.db.ValidateStreamKey(token, keyType, path, action)
			if err != nil {
				log.Printf("Hook: token validation error: %v", err)
			}
			if key != nil {
				log.Printf("Hook: authenticated via query param: %s...", key.Key[:12])
				w.WriteHeader(http.StatusOK)
				return
			}
		}
	}

	// 4. JWT token in query string (?jwt=xxx) - for authenticated users
	if req.Query != "" {
		jwtToken := extractQueryParam(req.Query, "jwt")
		if jwtToken != "" {
			user := h.auth.validateToken(jwtToken)
			if user != nil {
				// Check role permissions
				if action == "publish" && !canPublish(user.Role) {
					log.Printf("Hook: user %s (role=%s) cannot publish", user.Username, user.Role)
					http.Error(w, "Forbidden", http.StatusForbidden)
					return
				}
				if action == "read" && !canView(user.Role) {
					log.Printf("Hook: user %s (role=%s) cannot view", user.Username, user.Role)
					http.Error(w, "Forbidden", http.StatusForbidden)
					return
				}

				// Check path-specific permissions
				perm, _ := h.db.GetStreamPermission(path)
				if perm != nil && !roleHasPermission(user.Role, perm.AllowedRoles) {
					log.Printf("Hook: user %s (role=%s) not allowed for path=%s", user.Username, user.Role, path)
					http.Error(w, "Forbidden", http.StatusForbidden)
					return
				}

				log.Printf("Hook: authenticated via JWT: user=%s role=%s", user.Username, user.Role)
				w.WriteHeader(http.StatusOK)
				return
			}
		}
	}

	// 4. User/password authentication (for RTSP clients that support it)
	if req.User != "" && req.Password != "" {
		user, err := h.db.GetUserByUsername(req.User)
		if err == nil && user != nil && h.db.ValidatePassword(user, req.Password) {
			if action == "publish" && !canPublish(user.Role) {
				log.Printf("Hook: user %s cannot publish", user.Username)
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}
			log.Printf("Hook: authenticated via username/password: %s", user.Username)
			w.WriteHeader(http.StatusOK)
			return
		}
	}

	// No valid authentication found
	log.Printf("Hook: authentication failed for path=%s action=%s", path, action)
	http.Error(w, "Unauthorized", http.StatusUnauthorized)
}

// extractQueryParam extracts a parameter from a query string
func extractQueryParam(query, param string) string {
	parts := strings.Split(query, "&")
	for _, part := range parts {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) == 2 && kv[0] == param {
			return kv[1]
		}
	}
	return ""
}
