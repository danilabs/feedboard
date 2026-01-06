package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/mux"
)

// Config holds server configuration
type Config struct {
	Port          int
	DBPath        string
	JWTSecret     string
	SecureCookies bool
}

func main() {
	// Parse flags
	config := &Config{}
	flag.IntVar(&config.Port, "port", 8091, "HTTP server port")
	flag.StringVar(&config.DBPath, "db", "data/feedboard.db", "SQLite database path")
	flag.StringVar(&config.JWTSecret, "jwt-secret", "", "JWT signing secret (auto-generated if empty)")
	flag.BoolVar(&config.SecureCookies, "secure-cookies", false, "Set secure flag on cookies (enable for HTTPS)")
	flag.Parse()

	// Get JWT secret from env or flag, generate if not provided
	if config.JWTSecret == "" {
		config.JWTSecret = os.Getenv("JWT_SECRET")
	}
	if config.JWTSecret == "" {
		config.JWTSecret = generateSecureToken(32)
		log.Printf("WARNING: Generated JWT secret (tokens invalid on restart, set JWT_SECRET env var)")
	}

	// Initialize database
	db, err := InitDB(config.DBPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Create default admin if no users exist
	if password, generated, err := db.CreateDefaultAdmin(); err != nil {
		log.Fatalf("Failed to create default admin: %v", err)
	} else if password != "" {
		fmt.Println("=====================================")
		fmt.Println("  Default admin account created")
		fmt.Println("=====================================")
		fmt.Println("  Username: admin")
		if generated {
			fmt.Printf("  Password: %s\n", password)
			fmt.Println("=====================================")
			fmt.Println("  Change this password after login!")
		} else {
			fmt.Println("  Password: (from ADMIN_PASSWORD env)")
		}
		fmt.Println("=====================================")
	}

	// Initialize handlers
	authHandler := NewAuthHandler(db, config.JWTSecret, config.SecureCookies)
	hookHandler := NewHookHandler(db, authHandler)
	apiHandler := NewAPIHandler(db)

	// Set up router
	r := mux.NewRouter()

	// Auth endpoints (public)
	r.HandleFunc("/auth/login", authHandler.HandleLogin).Methods("POST")
	r.HandleFunc("/auth/logout", authHandler.HandleLogout).Methods("POST")
	r.HandleFunc("/auth/hook", hookHandler.HandleAuth).Methods("POST")
	r.HandleFunc("/auth/token", authHandler.HandleToken).Methods("GET") // Also used by Caddy forward_auth

	// Auth endpoints (authenticated)
	r.Handle("/auth/me", authHandler.RequireAuth(http.HandlerFunc(authHandler.HandleMe))).Methods("GET")
	r.Handle("/auth/password", authHandler.RequireAuth(http.HandlerFunc(authHandler.HandleChangePassword))).Methods("POST")

	// API endpoints (authenticated)
	api := r.PathPrefix("/api").Subrouter()

	// Current user
	api.Handle("/me", authHandler.RequireAuth(http.HandlerFunc(authHandler.HandleMe))).Methods("GET")

	// Stream keys (authenticated users can manage their own)
	api.Handle("/keys", authHandler.RequireAuth(http.HandlerFunc(apiHandler.HandleListStreamKeys))).Methods("GET")
	api.Handle("/keys", authHandler.RequireAuth(http.HandlerFunc(apiHandler.HandleCreateStreamKey))).Methods("POST")
	api.Handle("/keys/{id:[0-9]+}", authHandler.RequireAuth(http.HandlerFunc(apiHandler.HandleDeleteStreamKey))).Methods("DELETE")

	// Admin-only endpoints
	api.Handle("/users", authHandler.RequireAdmin(http.HandlerFunc(apiHandler.HandleListUsers))).Methods("GET")
	api.Handle("/users", authHandler.RequireAdmin(http.HandlerFunc(apiHandler.HandleCreateUser))).Methods("POST")
	api.Handle("/users/{id:[0-9]+}", authHandler.RequireAdmin(http.HandlerFunc(apiHandler.HandleGetUser))).Methods("GET")
	api.Handle("/users/{id:[0-9]+}", authHandler.RequireAdmin(http.HandlerFunc(apiHandler.HandleUpdateUser))).Methods("PUT")
	api.Handle("/users/{id:[0-9]+}", authHandler.RequireAdmin(http.HandlerFunc(apiHandler.HandleDeleteUser))).Methods("DELETE")
	api.Handle("/permissions", authHandler.RequireAdmin(http.HandlerFunc(apiHandler.HandleListPermissions))).Methods("GET")
	api.Handle("/permissions", authHandler.RequireAdmin(http.HandlerFunc(apiHandler.HandleSetPermission))).Methods("POST")
	api.Handle("/permissions/{id:[0-9]+}", authHandler.RequireAdmin(http.HandlerFunc(apiHandler.HandleDeletePermission))).Methods("DELETE")

	// Presets (read: public, write: admin-only)
	api.HandleFunc("/presets", apiHandler.HandleListPresets).Methods("GET")
	api.HandleFunc("/presets/{id:[0-9]+}", apiHandler.HandleGetPreset).Methods("GET")
	api.Handle("/presets", authHandler.RequireAdmin(http.HandlerFunc(apiHandler.HandleCreatePreset))).Methods("POST")
	api.Handle("/presets/{id:[0-9]+}", authHandler.RequireAdmin(http.HandlerFunc(apiHandler.HandleUpdatePreset))).Methods("PUT")
	api.Handle("/presets/{id:[0-9]+}", authHandler.RequireAdmin(http.HandlerFunc(apiHandler.HandleDeletePreset))).Methods("DELETE")

	// CORS middleware
	handler := corsMiddleware(r)

	// Start server
	addr := fmt.Sprintf(":%d", config.Port)
	log.Printf("Auth API listening on http://localhost%s", addr)
	log.Printf("MediaMTX auth hook: http://localhost%s/auth/hook", addr)
	log.Fatal(http.ListenAndServe(addr, handler))
}

// corsMiddleware adds CORS headers for development (Vite on different port)
// Set CORS_ORIGINS env var to enable. Supports:
//   - "*" to allow all origins
//   - "*.example.com" for suffix wildcards
//   - "http://localhost:5173" for exact match
//   - Comma-separated for multiple patterns
// Leave empty to disable CORS (production behind reverse proxy)
func corsMiddleware(next http.Handler) http.Handler {
	corsOrigins := os.Getenv("CORS_ORIGINS")
	var allowAll bool
	var exactOrigins = make(map[string]bool)
	var wildcardSuffixes []string

	if corsOrigins != "" {
		for _, pattern := range strings.Split(corsOrigins, ",") {
			pattern = strings.TrimSpace(pattern)
			if pattern == "*" {
				allowAll = true
			} else if strings.HasPrefix(pattern, "*.") {
				// *.example.com -> .example.com suffix
				wildcardSuffixes = append(wildcardSuffixes, pattern[1:])
			} else {
				exactOrigins[pattern] = true
			}
		}
		log.Printf("CORS enabled for origins: %s", corsOrigins)
	}

	isAllowed := func(origin string) bool {
		if allowAll {
			return true
		}
		if exactOrigins[origin] {
			return true
		}
		for _, suffix := range wildcardSuffixes {
			if strings.HasSuffix(origin, suffix) {
				return true
			}
		}
		return false
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && isAllowed(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		}

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
