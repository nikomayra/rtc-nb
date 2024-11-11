package connection

import (
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

type ConnectionManager struct {
    connections map[string]*websocket.Conn
    mutex       sync.Mutex
}

func NewConnectionManager() *ConnectionManager {
    return &ConnectionManager{
        connections: make(map[string]*websocket.Conn),
    }
}

func (cm *ConnectionManager) AddConnection(username string, conn *websocket.Conn) {
    cm.mutex.Lock()
    defer cm.mutex.Unlock()
    cm.connections[username] = conn
	log.Printf("Client, ID: %s connected.\n",username)
}

func (cm *ConnectionManager) RemoveConnection(username string) {
    cm.mutex.Lock()
    defer cm.mutex.Unlock()
    delete(cm.connections, username)
	log.Printf("Client, ID: %s disconnected.\n",username)
}

func (cm *ConnectionManager) GetConnection(username string) (*websocket.Conn, bool) {
    cm.mutex.Lock()
    defer cm.mutex.Unlock()
    conn, ok := cm.connections[username]
    return conn, ok
}