package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
)

// APIHandler handles JSON API endpoints
type APIHandler struct {
	db *DB
}

// NewAPIHandler creates a new API handler
func NewAPIHandler(db *DB) *APIHandler {
	return &APIHandler{db: db}
}

// User management endpoints

// HandleListUsers handles GET /api/users
func (h *APIHandler) HandleListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.db.ListUsers()
	if err != nil {
		log.Printf("List users error: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// HandleGetUser handles GET /api/users/{id}
func (h *APIHandler) HandleGetUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	user, err := h.db.GetUserByID(id)
	if err != nil {
		log.Printf("Get user error: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}
	if user == nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// HandleCreateUser handles POST /api/users
func (h *APIHandler) HandleCreateUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate
	if req.Username == "" {
		http.Error(w, "Username is required", http.StatusBadRequest)
		return
	}
	if len(req.Password) < 8 {
		http.Error(w, "Password must be at least 8 characters", http.StatusBadRequest)
		return
	}
	if req.Role == "" {
		req.Role = "viewer"
	}
	if req.Role != "viewer" && req.Role != "publisher" && req.Role != "admin" {
		http.Error(w, "Invalid role", http.StatusBadRequest)
		return
	}

	user, err := h.db.CreateUser(req.Username, req.Password, req.Role)
	if err != nil {
		log.Printf("Create user error: %v", err)
		http.Error(w, "Failed to create user (username may already exist)", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(user)
}

// HandleUpdateUser handles PUT /api/users/{id}
func (h *APIHandler) HandleUpdateUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Username string `json:"username"`
		Role     string `json:"role"`
		Password string `json:"password,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Update user info
	if err := h.db.UpdateUser(id, req.Username, req.Role); err != nil {
		log.Printf("Update user error: %v", err)
		http.Error(w, "Failed to update user", http.StatusInternalServerError)
		return
	}

	// Update password if provided
	if req.Password != "" {
		if len(req.Password) < 8 {
			http.Error(w, "Password must be at least 8 characters", http.StatusBadRequest)
			return
		}
		if err := h.db.UpdateUserPassword(id, req.Password); err != nil {
			log.Printf("Update password error: %v", err)
			http.Error(w, "Failed to update password", http.StatusInternalServerError)
			return
		}
	}

	user, _ := h.db.GetUserByID(id)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// HandleDeleteUser handles DELETE /api/users/{id}
func (h *APIHandler) HandleDeleteUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Don't allow deleting self
	currentUser := getUserFromContext(r.Context())
	if currentUser != nil && currentUser.ID == id {
		http.Error(w, "Cannot delete your own account", http.StatusBadRequest)
		return
	}

	if err := h.db.DeleteUser(id); err != nil {
		log.Printf("Delete user error: %v", err)
		http.Error(w, "Failed to delete user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Stream key endpoints

// HandleListStreamKeys handles GET /api/keys
func (h *APIHandler) HandleListStreamKeys(w http.ResponseWriter, r *http.Request) {
	keyType := r.URL.Query().Get("type")
	keys, err := h.db.ListStreamKeys(keyType)
	if err != nil {
		log.Printf("List stream keys error: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(keys)
}

// HandleCreateStreamKey handles POST /api/keys
func (h *APIHandler) HandleCreateStreamKey(w http.ResponseWriter, r *http.Request) {
	currentUser := getUserFromContext(r.Context())
	if currentUser == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Type        string `json:"type"`         // publish or playback
		PathPattern string `json:"path_pattern"` // e.g., "cam1", "studio/*", "*"
		Note        string `json:"note"`
		ExpiresIn   int    `json:"expires_in"` // seconds, 0 = never
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate
	if req.Type != "publish" && req.Type != "playback" {
		http.Error(w, "Type must be 'publish' or 'playback'", http.StatusBadRequest)
		return
	}
	if req.PathPattern == "" {
		http.Error(w, "Path pattern is required", http.StatusBadRequest)
		return
	}

	// Only publishers and admins can create publish keys
	if req.Type == "publish" && !canPublish(currentUser.Role) {
		http.Error(w, "Only publishers and admins can create publish keys", http.StatusForbidden)
		return
	}

	var expiresAt *time.Time
	if req.ExpiresIn > 0 {
		t := time.Now().Add(time.Duration(req.ExpiresIn) * time.Second)
		expiresAt = &t
	}

	key, err := h.db.CreateStreamKey(req.Type, req.PathPattern, currentUser.ID, req.Note, expiresAt)
	if err != nil {
		log.Printf("Create stream key error: %v", err)
		http.Error(w, "Failed to create stream key", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(key)
}

// HandleDeleteStreamKey handles DELETE /api/keys/{id}
func (h *APIHandler) HandleDeleteStreamKey(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid key ID", http.StatusBadRequest)
		return
	}

	// Check ownership (admins can delete any, others only their own)
	currentUser := getUserFromContext(r.Context())
	key, _ := h.db.GetStreamKeyByID(id)
	if key == nil {
		http.Error(w, "Key not found", http.StatusNotFound)
		return
	}
	if currentUser.Role != "admin" && key.OwnerID != currentUser.ID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	if err := h.db.DeleteStreamKey(id); err != nil {
		log.Printf("Delete stream key error: %v", err)
		http.Error(w, "Failed to delete stream key", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Stream permission endpoints

// HandleListPermissions handles GET /api/permissions
func (h *APIHandler) HandleListPermissions(w http.ResponseWriter, r *http.Request) {
	perms, err := h.db.ListStreamPermissions()
	if err != nil {
		log.Printf("List permissions error: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(perms)
}

// HandleSetPermission handles POST /api/permissions
func (h *APIHandler) HandleSetPermission(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PathPattern  string `json:"path_pattern"`
		IsPublic     bool   `json:"is_public"`
		AllowedRoles string `json:"allowed_roles"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.PathPattern == "" {
		http.Error(w, "Path pattern is required", http.StatusBadRequest)
		return
	}

	if err := h.db.SetStreamPermission(req.PathPattern, req.IsPublic, req.AllowedRoles); err != nil {
		log.Printf("Set permission error: %v", err)
		http.Error(w, "Failed to set permission", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Permission set"})
}

// HandleDeletePermission handles DELETE /api/permissions/{id}
func (h *APIHandler) HandleDeletePermission(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(mux.Vars(r)["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid permission ID", http.StatusBadRequest)
		return
	}

	if err := h.db.DeleteStreamPermission(id); err != nil {
		log.Printf("Delete permission error: %v", err)
		http.Error(w, "Failed to delete permission", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
