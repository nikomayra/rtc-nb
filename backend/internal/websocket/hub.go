package websocket

import (
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

type Hub struct {
	mu          sync.RWMutex
	connections map[string]*websocket.Conn          // username -> connection
	channels    map[string]map[*websocket.Conn]bool // channelUsername -> connection
}

func NewHub() *Hub {
	return &Hub{
		connections: make(map[string]*websocket.Conn),
		channels:    make(map[string]map[*websocket.Conn]bool),
	}
}

func (h *Hub) NotifyChannel(channelUsername string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if clients, ok := h.channels[channelUsername]; ok {
		for client := range clients {
			client.WriteMessage(0, message)
		}
	}
}

func (h *Hub) NotifyUser(username string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if conn, ok := h.connections[username]; ok {
		conn.WriteMessage(0, message)
	}
}

func (h *Hub) AddConnection(username string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.connections[username] = conn
	log.Printf("Client Username: %s, connected.\n", username)
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
