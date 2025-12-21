package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

// User represents a user account
type User struct {
	ID           int64     `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"` // viewer, publisher, admin
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// StreamKey represents a publish or playback key
type StreamKey struct {
	ID          int64      `json:"id"`
	KeyHash     string     `json:"-"`
	KeyPrefix   string     `json:"key_prefix"` // first 8 chars for display
	Type        string     `json:"type"`       // publish, playback
	PathPattern string     `json:"path_pattern"`
	OwnerID     int64      `json:"owner_id"`
	OwnerName   string     `json:"owner_name,omitempty"`
	Note        string     `json:"note"`
	CreatedAt   time.Time  `json:"created_at"`
	ExpiresAt   *time.Time `json:"expires_at"`
	LastUsedAt  *time.Time `json:"last_used_at"`
}

// StreamPermission defines access rules for stream paths
type StreamPermission struct {
	ID           int64  `json:"id"`
	PathPattern  string `json:"path_pattern"`
	IsPublic     bool   `json:"is_public"`
	AllowedRoles string `json:"allowed_roles"` // comma-separated: "viewer,publisher,admin"
}

// DB wraps the database connection
type DB struct {
	*sql.DB
}

// InitDB creates and initializes the database
func InitDB(dbPath string) (*DB, error) {
	// Ensure directory exists
	dir := filepath.Dir(dbPath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create db directory: %w", err)
		}
	}

	db, err := sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Create tables
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		role TEXT NOT NULL DEFAULT 'viewer',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS stream_keys (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		key_hash TEXT UNIQUE NOT NULL,
		key_prefix TEXT NOT NULL,
		type TEXT NOT NULL,
		path_pattern TEXT NOT NULL,
		owner_id INTEGER NOT NULL,
		note TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		expires_at DATETIME,
		last_used_at DATETIME,
		FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS stream_permissions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		path_pattern TEXT UNIQUE NOT NULL,
		is_public BOOLEAN DEFAULT FALSE,
		allowed_roles TEXT DEFAULT 'viewer,publisher,admin'
	);

	CREATE INDEX IF NOT EXISTS idx_stream_keys_type ON stream_keys(type);
	CREATE INDEX IF NOT EXISTS idx_stream_keys_owner ON stream_keys(owner_id);
	`

	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("failed to create schema: %w", err)
	}

	return &DB{db}, nil
}

// CreateDefaultAdmin creates the default admin user if no users exist
func (db *DB) CreateDefaultAdmin() (string, error) {
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		return "", err
	}

	if count > 0 {
		return "", nil // Users exist, don't create default
	}

	// Generate random password
	password := generateSecureToken(12)
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}

	_, err = db.Exec(
		"INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
		"admin", string(hash), "admin",
	)
	if err != nil {
		return "", err
	}

	return password, nil
}

// User operations

func (db *DB) GetUserByID(id int64) (*User, error) {
	user := &User{}
	err := db.QueryRow(
		"SELECT id, username, password_hash, role, created_at, updated_at FROM users WHERE id = ?",
		id,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Role, &user.CreatedAt, &user.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return user, err
}

func (db *DB) GetUserByUsername(username string) (*User, error) {
	user := &User{}
	err := db.QueryRow(
		"SELECT id, username, password_hash, role, created_at, updated_at FROM users WHERE username = ?",
		username,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Role, &user.CreatedAt, &user.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return user, err
}

func (db *DB) ListUsers() ([]User, error) {
	rows, err := db.Query("SELECT id, username, role, created_at, updated_at FROM users ORDER BY username")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (db *DB) CreateUser(username, password, role string) (*User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	result, err := db.Exec(
		"INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
		username, string(hash), role,
	)
	if err != nil {
		return nil, err
	}

	id, _ := result.LastInsertId()
	return db.GetUserByID(id)
}

func (db *DB) UpdateUser(id int64, username, role string) error {
	_, err := db.Exec(
		"UPDATE users SET username = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		username, role, id,
	)
	return err
}

func (db *DB) UpdateUserPassword(id int64, password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = db.Exec(
		"UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		string(hash), id,
	)
	return err
}

func (db *DB) DeleteUser(id int64) error {
	_, err := db.Exec("DELETE FROM users WHERE id = ?", id)
	return err
}

func (db *DB) ValidatePassword(user *User, password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	return err == nil
}

// Stream key operations

func (db *DB) CreateStreamKey(keyType, pathPattern string, ownerID int64, note string, expiresAt *time.Time) (*StreamKey, string, error) {
	// Generate the actual key
	key := generateStreamKey(keyType)
	hash, err := bcrypt.GenerateFromPassword([]byte(key), bcrypt.DefaultCost)
	if err != nil {
		return nil, "", err
	}

	prefix := key[:12] + "..."

	result, err := db.Exec(
		"INSERT INTO stream_keys (key_hash, key_prefix, type, path_pattern, owner_id, note, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		string(hash), prefix, keyType, pathPattern, ownerID, note, expiresAt,
	)
	if err != nil {
		return nil, "", err
	}

	id, _ := result.LastInsertId()
	sk, err := db.GetStreamKeyByID(id)
	return sk, key, err
}

func (db *DB) GetStreamKeyByID(id int64) (*StreamKey, error) {
	sk := &StreamKey{}
	err := db.QueryRow(`
		SELECT sk.id, sk.key_prefix, sk.type, sk.path_pattern, sk.owner_id, u.username, sk.note, sk.created_at, sk.expires_at, sk.last_used_at
		FROM stream_keys sk
		JOIN users u ON sk.owner_id = u.id
		WHERE sk.id = ?`,
		id,
	).Scan(&sk.ID, &sk.KeyPrefix, &sk.Type, &sk.PathPattern, &sk.OwnerID, &sk.OwnerName, &sk.Note, &sk.CreatedAt, &sk.ExpiresAt, &sk.LastUsedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return sk, err
}

func (db *DB) ListStreamKeys(keyType string) ([]StreamKey, error) {
	query := `
		SELECT sk.id, sk.key_prefix, sk.type, sk.path_pattern, sk.owner_id, u.username, sk.note, sk.created_at, sk.expires_at, sk.last_used_at
		FROM stream_keys sk
		JOIN users u ON sk.owner_id = u.id
	`
	args := []interface{}{}
	if keyType != "" {
		query += " WHERE sk.type = ?"
		args = append(args, keyType)
	}
	query += " ORDER BY sk.created_at DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []StreamKey
	for rows.Next() {
		var sk StreamKey
		if err := rows.Scan(&sk.ID, &sk.KeyPrefix, &sk.Type, &sk.PathPattern, &sk.OwnerID, &sk.OwnerName, &sk.Note, &sk.CreatedAt, &sk.ExpiresAt, &sk.LastUsedAt); err != nil {
			return nil, err
		}
		keys = append(keys, sk)
	}
	return keys, rows.Err()
}

func (db *DB) ValidateStreamKey(key, keyType, path, action string) (*StreamKey, error) {
	// Get all keys of this type and check each one
	rows, err := db.Query(`
		SELECT id, key_hash, key_prefix, type, path_pattern, owner_id, expires_at
		FROM stream_keys
		WHERE type = ?`,
		keyType,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var sk StreamKey
		var keyHash string
		if err := rows.Scan(&sk.ID, &keyHash, &sk.KeyPrefix, &sk.Type, &sk.PathPattern, &sk.OwnerID, &sk.ExpiresAt); err != nil {
			continue
		}

		// Check if key matches
		if err := bcrypt.CompareHashAndPassword([]byte(keyHash), []byte(key)); err != nil {
			continue
		}

		// Check expiration
		if sk.ExpiresAt != nil && time.Now().After(*sk.ExpiresAt) {
			log.Printf("Stream key expired: %s", sk.KeyPrefix)
			return nil, nil
		}

		// Check path pattern
		if !matchPath(sk.PathPattern, path) {
			log.Printf("Path mismatch: pattern=%s path=%s", sk.PathPattern, path)
			continue
		}

		// Update last used
		db.Exec("UPDATE stream_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?", sk.ID)

		return &sk, nil
	}

	return nil, nil
}

func (db *DB) DeleteStreamKey(id int64) error {
	_, err := db.Exec("DELETE FROM stream_keys WHERE id = ?", id)
	return err
}

// Stream permissions

func (db *DB) GetStreamPermission(path string) (*StreamPermission, error) {
	// First try exact match, then pattern matches
	rows, err := db.Query("SELECT id, path_pattern, is_public, allowed_roles FROM stream_permissions ORDER BY length(path_pattern) DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var sp StreamPermission
		if err := rows.Scan(&sp.ID, &sp.PathPattern, &sp.IsPublic, &sp.AllowedRoles); err != nil {
			continue
		}
		if matchPath(sp.PathPattern, path) {
			return &sp, nil
		}
	}

	return nil, nil // No specific permission, use defaults
}

func (db *DB) SetStreamPermission(pathPattern string, isPublic bool, allowedRoles string) error {
	_, err := db.Exec(`
		INSERT INTO stream_permissions (path_pattern, is_public, allowed_roles)
		VALUES (?, ?, ?)
		ON CONFLICT(path_pattern) DO UPDATE SET is_public = ?, allowed_roles = ?`,
		pathPattern, isPublic, allowedRoles, isPublic, allowedRoles,
	)
	return err
}

func (db *DB) ListStreamPermissions() ([]StreamPermission, error) {
	rows, err := db.Query("SELECT id, path_pattern, is_public, allowed_roles FROM stream_permissions ORDER BY path_pattern")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var perms []StreamPermission
	for rows.Next() {
		var sp StreamPermission
		if err := rows.Scan(&sp.ID, &sp.PathPattern, &sp.IsPublic, &sp.AllowedRoles); err != nil {
			return nil, err
		}
		perms = append(perms, sp)
	}
	return perms, rows.Err()
}

func (db *DB) DeleteStreamPermission(id int64) error {
	_, err := db.Exec("DELETE FROM stream_permissions WHERE id = ?", id)
	return err
}
