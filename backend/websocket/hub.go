package connection

import (
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

type ConnectionManager struct {
	connections map[string]*Connection
	mutex       sync.Mutex
}

func NewConnectionManager() *ConnectionManager {
	return &ConnectionManager{
		connections: make(map[string]*Connection),
	}
}

func (cm *ConnectionManager) BroadcastMessage(message []byte) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()
	for _, conn := range cm.connections {
		conn.WriteMessage(websocket.TextMessage, message)
	}
}

func (cm *ConnectionManager) AddConnection(username string, conn *websocket.Conn) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()
	cm.connections[username] = &Connection{conn: conn}
	log.Printf("Client Username: %s, connected.\n", username)
}

func (cm *ConnectionManager) RemoveConnection(username string) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()
	delete(cm.connections, username)
	log.Printf("Client Username: %s, disconnected.\n", username)
}

func (cm *ConnectionManager) GetConnection(username string) (*Connection, bool) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()
	conn, ok := cm.connections[username]
	return conn, ok
}
