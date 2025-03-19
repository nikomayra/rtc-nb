package connections

import "github.com/gorilla/websocket"

type Manager interface {
	// Connection Management
	AddConnection(username string, conn *websocket.Conn)
	RemoveConnection(username string)
	GetConnection(username string) (*websocket.Conn, bool)

	// System Connection Management
	AddSystemConnection(username string, conn *websocket.Conn)
	RemoveSystemConnection(username string)
	GetSystemConnection(username string) (*websocket.Conn, bool)

	// Channel Management
	InitializeChannel(channelName string) error
	NotifyChannel(channelName string, message []byte)
	AddClientToChannel(channelName string, userConn *websocket.Conn)
	RemoveClientFromChannel(channelName string, userConn *websocket.Conn)
	RemoveAllClientsFromChannel(channelName string)

	// User Management
	NotifyUser(username string, message []byte)
	GetUserChannel(username string) (string, error)

	// All
	NotifyAll(message []byte)
}
