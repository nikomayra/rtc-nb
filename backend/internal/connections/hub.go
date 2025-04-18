package connections

import (
	"fmt"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Hub struct {
	mu            sync.RWMutex
	connections   map[string]*websocket.Conn          // Regular channel connections: username -> connection
	systemConns   map[string]*websocket.Conn          // System-level connections: username -> connection
	channels      map[string]map[*websocket.Conn]bool // channelName -> user connections: bool
	connToChannel map[*websocket.Conn]string          // Maps connections to their channel
}

func NewHub() *Hub {
	return &Hub{
		connections:   make(map[string]*websocket.Conn),
		systemConns:   make(map[string]*websocket.Conn),
		channels:      make(map[string]map[*websocket.Conn]bool),
		connToChannel: make(map[*websocket.Conn]string),
	}
}

func (h *Hub) InitializeChannel(channelName string) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.channels[channelName]; ok {
		return fmt.Errorf("channel already exists: %s", channelName)
	}
	h.channels[channelName] = make(map[*websocket.Conn]bool)
	return nil
}

// NotifyChannel broadcasts a message to all clients in a specific channel
func (h *Hub) NotifyChannel(channelName string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if channelName == "" {
		return
	}

	channelClients, exists := h.channels[channelName]
	if !exists {
		return
	}

	if len(channelClients) == 0 {
		return
	}

	for client := range channelClients {
		err := client.WriteMessage(websocket.TextMessage, message)
		if err != nil {
			// Connection errors will be handled by the cleanup routine
		}
	}
}

func (h *Hub) NotifyUser(username string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if conn, ok := h.connections[username]; ok {
		conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
		if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
			// log.Printf("Error writing message to client: %v", err)
		}
	}
}

// NotifyAll broadcasts a message to all system connections
func (h *Hub) NotifyAll(message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	// log.Printf("Broadcasting system message to %d system connections", len(h.systemConns))

	if len(h.systemConns) == 0 {
		// log.Printf("No system connections available for broadcasting")
		return
	}

	for _, conn := range h.systemConns {
		err := conn.WriteMessage(websocket.TextMessage, message)
		if err != nil {
			// Connection errors will be handled by the cleanup routine
		}
	}
}

func (h *Hub) GetUserChannel(username string) (string, error) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	userConn, ok := h.connections[username]
	if !ok {
		return "", fmt.Errorf("user not connected: %s", username)
	}
	channelName, ok := h.connToChannel[userConn]
	if !ok {
		return "", fmt.Errorf("user not in any channel: %s", username)
	}
	return channelName, nil
}

func (h *Hub) AddClientToChannel(channelName string, userConn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.channels[channelName]; !ok {
		h.channels[channelName] = make(map[*websocket.Conn]bool)
	}
	h.channels[channelName][userConn] = true
	h.connToChannel[userConn] = channelName
	// log.Printf("Added client to channel: %s\n", channelName)
}

func (h *Hub) RemoveClientFromChannel(channelName string, userConn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if conns, ok := h.channels[channelName]; ok {
		delete(conns, userConn)
		delete(h.connToChannel, userConn)
	}
	// log.Printf("Removed client from channel: %s\n", channelName)
}

func (h *Hub) AddConnection(username string, conn *websocket.Conn) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, exists := h.connections[username]; exists {
		// log.Printf("Attempt to add connection for user %s failed: connection already exists.", username)
		return fmt.Errorf("connection already exists for user: %s", username)
	}

	h.connections[username] = conn
	// log.Printf("Client Username: %s, connected. Total connections: %d", username, len(h.connections))
	return nil
}

func (h *Hub) RemoveConnection(username string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.connections, username)
	// log.Printf("Client Username: %s, disconnected.\n", username)
}

func (h *Hub) GetConnection(username string) (*websocket.Conn, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	conn, ok := h.connections[username]
	return conn, ok
}

// System connection methods
func (h *Hub) AddSystemConnection(username string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if existingConn, exists := h.systemConns[username]; exists {
		// log.Printf("Closing existing system connection for user: %s", username)
		existingConn.Close()
	}

	h.systemConns[username] = conn
	// log.Printf("System connection added for user: %s (total: %d)", username, len(h.systemConns))
}

func (h *Hub) RemoveSystemConnection(username string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.systemConns, username)
	// log.Printf("System connection removed for user: %s (remaining: %d)", username, len(h.systemConns))
}

func (h *Hub) GetSystemConnection(username string) (*websocket.Conn, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	conn, ok := h.systemConns[username]
	return conn, ok
}

func (h *Hub) GetOnlineUsersInChannel(channelName string) []string {
	h.mu.RLock()
	defer h.mu.RUnlock()

	usernames := make([]string, 0)
	if channelConns, ok := h.channels[channelName]; ok {
		// For each connection in the channel
		for conn := range channelConns {
			// Find the username associated with this connection
			for username, userConn := range h.connections {
				if userConn == conn {
					usernames = append(usernames, username)
					break
				}
			}
		}
	}
	return usernames
}

func (h *Hub) GetCountOfAllOnlineUsers() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.systemConns)
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

	// Check regular connections
	for username, conn := range h.connections {
		if err := conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(3*time.Second)); err != nil {
			h.cleanupConnection(username, conn, false)
		}
	}

	// Check system connections
	for username, conn := range h.systemConns {
		if err := conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(3*time.Second)); err != nil {
			h.cleanupConnection(username, conn, true)
		}
	}
}

func (h *Hub) cleanupConnection(username string, conn *websocket.Conn, isSystem bool) {
	conn.Close()

	if isSystem {
		delete(h.systemConns, username)
		// log.Printf("Cleaned up stale system connection for user: %s", username)
	} else {
		delete(h.connections, username)
		// log.Printf("Cleaned up stale channel connection for user: %s", username)

		// Clean up from channels
		for _, clients := range h.channels {
			if _, ok := clients[conn]; ok {
				delete(clients, conn)
				delete(h.connToChannel, conn)
				// log.Printf("Removed user %s from channel %s during cleanup", username, channelName)
			}
		}
	}
}

// RemoveAllClientsFromChannel removes all clients from a specific channel
func (h *Hub) RemoveAllClientsFromChannel(channelName string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if clients, exists := h.channels[channelName]; exists {
		// Copy the clients to avoid modifying the map during iteration
		clientsToRemove := make([]*websocket.Conn, 0, len(clients))
		for client := range clients {
			clientsToRemove = append(clientsToRemove, client)
		}

		// Remove each client from the channel
		for _, client := range clientsToRemove {
			delete(clients, client)
			delete(h.connToChannel, client)
		}

		// Remove the channel if it's empty
		delete(h.channels, channelName)
	}
}
