package chat

import (
	"sync"

	"rtc-nb/backend/internal/store/database"
	"rtc-nb/backend/internal/websocket"
)

type messageManager struct {
	mu  sync.Mutex
	db  *database.Store
	hub *websocket.Hub
}

func NewMessageManager(db *database.Store, hub *websocket.Hub) *messageManager {
	return &messageManager{
		db:  db,
		hub: hub,
	}
}
