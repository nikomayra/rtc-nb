package connection

import (
	"sync"

	"github.com/gorilla/websocket"
)

type Connection struct {
	conn    *websocket.Conn
	writeMu sync.Mutex
}

func (c *Connection) WriteMessage(messageType int, data []byte) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	return c.conn.WriteMessage(messageType, data)
}
