package websocket

import (
	"log"
	"sync"
	// "github.com/gorilla/websocket"
)

type Hub struct {
	mu          sync.RWMutex
	connections map[string]*Connection // userID -> connection
	channels    map[string]map[*Connection]bool
}

func NewHub() *Hub {
	return &Hub{
		connections: make(map[string]*Connection),
		channels:    make(map[string]map[*Connection]bool),
	}
}

func (h *Hub) Broadcast(channelID string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if clients, ok := h.channels[channelID]; ok {
		for client := range clients {
			client.WriteMessage(0, message)
		}
	}
}

func (h *Hub) AddConnection(username string, conn *Connection) {
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

func (h *Hub) GetConnection(username string) (*Connection, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	conn, ok := h.connections[username]
	return conn, ok
}
