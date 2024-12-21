package websocket

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Hub struct {
	mu          sync.RWMutex
	connections map[string]*websocket.Conn          // username -> connection
	channels    map[string]map[*websocket.Conn]bool // channelName -> user connections: bool
}

func NewHub() *Hub {
	return &Hub{
		connections: make(map[string]*websocket.Conn),
		channels:    make(map[string]map[*websocket.Conn]bool),
	}
}

func (h *Hub) InitializeChannel(channelName string) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.channels[channelName]; !ok {
		return fmt.Errorf("channel already exists: %s", channelName)
	}
	h.channels[channelName] = make(map[*websocket.Conn]bool)
	return nil
}

func (h *Hub) NotifyChannel(channelName string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	log.Printf("NotifyChannel: channelName=%s clients=%v\n", channelName, len(h.channels[channelName]))
	if clients, ok := h.channels[channelName]; ok {
		for client := range clients {
			if err := client.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("Error writing message to client: %v", err)
			}
		}
	} else {
		log.Printf("No clients in channel: %s", channelName)
	}
}

func (h *Hub) NotifyUser(username string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if conn, ok := h.connections[username]; ok {
		if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
			log.Printf("Error writing message to client: %v", err)
		}
	}
}

func (h *Hub) AddClientToChannel(channelName string, userConn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.channels[channelName]; !ok {
		h.channels[channelName] = make(map[*websocket.Conn]bool)
	}
	h.channels[channelName][userConn] = true
	log.Printf("Added client to channel: %s\n", channelName)
}

func (h *Hub) RemoveClientFromChannel(channelName string, userConn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.channels[channelName]; !ok {
		return
	}
	delete(h.channels[channelName], userConn)
	if len(h.channels[channelName]) == 0 {
		delete(h.channels, channelName)
	}
	log.Printf("Removed client from channel: %s\n", channelName)
}

func (h *Hub) AddConnection(username string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// If there's an existing connection, close it
	if existingConn, exists := h.connections[username]; exists {
		log.Printf("Closing existing connection for user: %s", username)
		existingConn.Close()
	}

	h.connections[username] = conn
	log.Printf("Client Username: %s, connected. Total connections: %d", username, len(h.connections))
}

func (h *Hub) RemoveConnection(username string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.connections, username)
	log.Printf("Client Username: %s, disconnected.\n", username)
}

func (h *Hub) GetConnection(username string) (*websocket.Conn, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	conn, ok := h.connections[username]
	return conn, ok
}

// AUTOMATIC CLEANUP

func (h *Hub) StartCleanupTicker() {
	ticker := time.NewTicker(45 * time.Second)
	go func() {
		for range ticker.C {
			h.cleanupStaleConnections()
		}
	}()
}

func (h *Hub) cleanupStaleConnections() {
	h.mu.Lock()
	defer h.mu.Unlock()

	for username, conn := range h.connections {
		if err := conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(3*time.Second)); err != nil {
			h.cleanupConnection(username, conn)
		}
	}
}

func (h *Hub) cleanupConnection(username string, conn *websocket.Conn) {
	conn.Close()
	h.RemoveConnection(username)

	// Clean up from channels
	for channelName, clients := range h.channels {
		if _, ok := clients[conn]; ok {
			h.RemoveClientFromChannel(channelName, conn)
		}
	}
	log.Printf("Cleaned up stale connection for user: %s", username)
}
