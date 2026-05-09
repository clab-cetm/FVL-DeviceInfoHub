package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/hypebeast/go-osc/osc"
	_ "modernc.org/sqlite"
)

// DatabaseSettings describes the OSC message shape for one database.
type DatabaseSettings struct {
	OSCTypeTag   string   `json:"osc_type_tag"`
	OSCParamName []string `json:"osc_param_name"`
}

// Config represents the server configuration loaded from config.json.
type Config struct {
	UDPBroadcastAddr       string                      `json:"udp_broadcast_addr"`
	UDPBroadcastIntervalMs int                         `json:"udp_broadcast_interval_ms"`
	BroadcastMessageStr    string                      `json:"broadcast_message_str"`
	OSCServerPort          int                         `json:"osc_server_port"`
	Databases              map[string]DatabaseSettings `json:"databases"`
	HTTPServerPort         int                         `json:"http_server_port"`
	DeviceIDToFriendlyName map[string]string           `json:"device_id_to_friendly_name"`
	StaticDir              string                      `json:"static_dir"`
}

func loadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	return &cfg, nil
}

func validateConfig(cfg *Config) error {
	if len(cfg.Databases) == 0 {
		return fmt.Errorf("databases must contain at least one entry")
	}
	for name, s := range cfg.Databases {
		tag := s.OSCTypeTag
		if !strings.HasPrefix(tag, ",") {
			return fmt.Errorf("databases[%q].osc_type_tag must start with ','", name)
		}
		types := tag[1:]
		if len(types) == 0 {
			return fmt.Errorf("databases[%q].osc_type_tag has no type characters", name)
		}
		if types[0] != 's' {
			return fmt.Errorf("databases[%q]: first type in osc_type_tag must be 's' (string for device id), got '%c'", name, types[0])
		}
		if len(s.OSCParamName) != len(types) {
			return fmt.Errorf("databases[%q]: osc_param_name length (%d) must match osc_type_tag length (%d)", name, len(s.OSCParamName), len(types))
		}
	}
	return nil
}

func initDB(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS devices (
		friendly_name TEXT PRIMARY KEY,
		data          TEXT NOT NULL,
		ip            TEXT NOT NULL DEFAULT '',
		updated_at    TEXT NOT NULL
	)`)
	if err != nil {
		return nil, fmt.Errorf("create table: %w", err)
	}
	// Migrate: add ip column if upgrading from an older schema.
	db.Exec(`ALTER TABLE devices ADD COLUMN ip TEXT NOT NULL DEFAULT ''`)
	return db, nil
}

func upsertDevice(db *sql.DB, friendlyName, dataJSON, ip string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := db.Exec(`INSERT INTO devices (friendly_name, data, ip, updated_at) VALUES (?, ?, ?, ?)
		ON CONFLICT(friendly_name) DO UPDATE SET data=excluded.data, ip=excluded.ip, updated_at=excluded.updated_at`,
		friendlyName, dataJSON, ip, now)
	return err
}

// startUDPBroadcast sends a broadcast message at a fixed interval.
func startUDPBroadcast(cfg *Config) {
	addr, err := net.ResolveUDPAddr("udp4", cfg.UDPBroadcastAddr)
	if err != nil {
		log.Fatalf("resolve broadcast addr: %v", err)
	}
	conn, err := net.DialUDP("udp4", nil, addr)
	if err != nil {
		log.Fatalf("dial broadcast: %v", err)
	}
	defer conn.Close()

	interval := time.Duration(cfg.UDPBroadcastIntervalMs) * time.Millisecond
	msg := []byte(cfg.BroadcastMessageStr)
	log.Printf("[Broadcast] sending %q to %s every %v", cfg.BroadcastMessageStr, cfg.UDPBroadcastAddr, interval)

	for {
		_, err := conn.Write(msg)
		if err != nil {
			log.Printf("[Broadcast] write error: %v", err)
		}
		time.Sleep(interval)
	}
}

// handleOSCMessage processes a parsed OSC message with its sender IP.
// It routes to a database by stripping the leading '/' from the OSC address
// and using the remainder as the key into cfg.Databases / dbs.
func handleOSCMessage(cfg *Config, dbs map[string]*sql.DB, msg *osc.Message, senderIP string) {
	if !strings.HasPrefix(msg.Address, "/") {
		log.Printf("[OSC] address %q missing leading '/'", msg.Address)
		return
	}
	dbName := msg.Address[1:]
	settings, ok := cfg.Databases[dbName]
	if !ok {
		log.Printf("[OSC] no database registered for address %q", msg.Address)
		return
	}
	db, ok := dbs[dbName]
	if !ok {
		log.Printf("[OSC] database %q not initialized", dbName)
		return
	}

	typeChars := settings.OSCTypeTag[1:] // strip leading comma

	if len(msg.Arguments) != len(typeChars) {
		log.Printf("[OSC] %s: argument count mismatch: got %d, want %d", dbName, len(msg.Arguments), len(typeChars))
		return
	}

	// First argument is device id (string).
	deviceID, ok := msg.Arguments[0].(string)
	if !ok {
		log.Printf("[OSC] %s: first argument is not a string", dbName)
		return
	}

	friendlyName, registered := cfg.DeviceIDToFriendlyName[deviceID]
	if !registered {
		log.Printf("[OSC] unregistered device id: %s", deviceID)
		return
	}

	// Build a map of param_name -> value for all arguments.
	dataMap := make(map[string]interface{}, len(settings.OSCParamName))
	for i, name := range settings.OSCParamName {
		dataMap[name] = msg.Arguments[i]
	}

	dataBytes, err := json.Marshal(dataMap)
	if err != nil {
		log.Printf("[OSC] %s: json marshal error: %v", dbName, err)
		return
	}

	if err := upsertDevice(db, friendlyName, string(dataBytes), senderIP); err != nil {
		log.Printf("[OSC] %s: db upsert error: %v", dbName, err)
		return
	}
	log.Printf("[OSC] %s: updated %s (%s) from %s", dbName, friendlyName, deviceID, senderIP)
}

// startOSCServer listens for OSC messages via raw UDP to capture sender IP.
func startOSCServer(cfg *Config, dbs map[string]*sql.DB) {
	listenAddr := fmt.Sprintf("0.0.0.0:%d", cfg.OSCServerPort)
	conn, err := net.ListenPacket("udp", listenAddr)
	if err != nil {
		log.Fatalf("OSC listen: %v", err)
	}
	defer conn.Close()

	addrs := make([]string, 0, len(cfg.Databases))
	for name := range cfg.Databases {
		addrs = append(addrs, "/"+name)
	}
	log.Printf("[OSC] listening on port %d, addresses %v", cfg.OSCServerPort, addrs)

	buf := make([]byte, 65535)
	for {
		n, addr, err := conn.ReadFrom(buf)
		if err != nil {
			log.Printf("[OSC] read error: %v", err)
			continue
		}

		senderIP := addr.String()
		if host, _, err := net.SplitHostPort(senderIP); err == nil {
			senderIP = host
		}

		packet, err := osc.ParsePacket(string(buf[:n]))
		if err != nil {
			log.Printf("[OSC] parse error: %v", err)
			continue
		}

		switch p := packet.(type) {
		case *osc.Message:
			handleOSCMessage(cfg, dbs, p, senderIP)
		case *osc.Bundle:
			for _, m := range p.Messages {
				handleOSCMessage(cfg, dbs, m, senderIP)
			}
		}
	}
}

// startHTTPServer provides REST endpoints to query device data:
//   GET /{database_name}/{friendly_name} -> one device
//   GET /{database_name}/all             -> all devices in that database
func startHTTPServer(cfg *Config, dbs map[string]*sql.DB) {
	staticDir := cfg.StaticDir
	if staticDir == "" {
		staticDir = "."
	}
	if abs, err := filepath.Abs(staticDir); err == nil {
		log.Printf("[HTTP] serving static files from %s", abs)
	}
	staticFiles := http.FileServer(http.Dir(staticDir))

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		path := strings.TrimPrefix(r.URL.Path, "/")
		parts := strings.SplitN(path, "/", 2)

		// Route to the API only when the first segment names a known database;
		// everything else falls through to static file serving.
		if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
			staticFiles.ServeHTTP(w, r)
			return
		}
		dbName, rest := parts[0], parts[1]

		db, ok := dbs[dbName]
		if !ok {
			staticFiles.ServeHTTP(w, r)
			return
		}

		if rest == "all" {
			rows, err := db.Query("SELECT friendly_name, data, ip, updated_at FROM devices")
			if err != nil {
				http.Error(w, "internal error", http.StatusInternalServerError)
				log.Printf("[HTTP] %s: query error: %v", dbName, err)
				return
			}
			defer rows.Close()

			var devices []map[string]interface{}
			for rows.Next() {
				var name, data, ip, updatedAt string
				if err := rows.Scan(&name, &data, &ip, &updatedAt); err != nil {
					continue
				}
				var dataObj json.RawMessage
				if err := json.Unmarshal([]byte(data), &dataObj); err != nil {
					dataObj = json.RawMessage(data)
				}
				devices = append(devices, map[string]interface{}{
					"friendly_name": name,
					"data":          dataObj,
					"ip":            ip,
					"updated_at":    updatedAt,
				})
			}

			if devices == nil {
				devices = []map[string]interface{}{}
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(devices)
			return
		}

		// Single-device lookup.
		name := rest
		var data, ip, updatedAt string
		err := db.QueryRow("SELECT data, ip, updated_at FROM devices WHERE friendly_name = ?", name).Scan(&data, &ip, &updatedAt)
		if err == sql.ErrNoRows {
			http.Error(w, "not found", http.StatusNotFound)
			return
		} else if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			log.Printf("[HTTP] %s: query error: %v", dbName, err)
			return
		}

		var dataObj json.RawMessage
		if err := json.Unmarshal([]byte(data), &dataObj); err != nil {
			dataObj = json.RawMessage(data)
		}

		resp := map[string]interface{}{
			"data":       dataObj,
			"ip":         ip,
			"updated_at": updatedAt,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	})

	addr := fmt.Sprintf(":%d", cfg.HTTPServerPort)
	log.Printf("[HTTP] listening on port %d", cfg.HTTPServerPort)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("HTTP server: %v", err)
	}
}

func main() {
	cfg, err := loadConfig("config.json")
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	if err := validateConfig(cfg); err != nil {
		log.Fatalf("invalid config: %v", err)
	}

	const dbDir = "db"
	if err := os.MkdirAll(dbDir, 0o755); err != nil {
		log.Fatalf("create db dir: %v", err)
	}

	dbs := make(map[string]*sql.DB, len(cfg.Databases))
	for name := range cfg.Databases {
		db, err := initDB(filepath.Join(dbDir, name+".db"))
		if err != nil {
			log.Fatalf("init db %q: %v", name, err)
		}
		dbs[name] = db
	}
	defer func() {
		for _, db := range dbs {
			db.Close()
		}
	}()

	log.Println("DeviceInfoHub server starting...")

	go startUDPBroadcast(cfg)
	go startOSCServer(cfg, dbs)

	// HTTP server runs on the main goroutine.
	startHTTPServer(cfg, dbs)
}
