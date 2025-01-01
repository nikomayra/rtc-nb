package connections

import "github.com/gorilla/websocket"

type Manager interface {
	// Connection Management
	AddConnection(username string, conn *websocket.Conn)
    RemoveConnection(username string)
    GetConnection(username string) (*websocket.Conn, bool)
    
    // Channel Management
	InitializeChannel(channelName string) error
	NotifyChannel(channelName string, message []byte)
	AddClientToChannel(channelName string, userConn *websocket.Conn)
	RemoveClientFromChannel(channelName string, userConn *websocket.Conn)

	// User Management
	NotifyUser(username string, message []byte)
	GetUserChannel(username string) (string, error)
}
