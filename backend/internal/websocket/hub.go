package websocket

import (
	"log"
	"sync"

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
	delete(h.channels[channelName], userConn)
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
