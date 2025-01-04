package chat

import (
	"context"

	"rtc-nb/backend/internal/connections"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/internal/store/database"
)

type messageManager struct {
	db      *database.Store
	connMgr connections.Manager
}

func NewMessageManager(db *database.Store, connMgr connections.Manager) *messageManager {
	return &messageManager{
		db:      db,
		connMgr: connMgr,
	}
}

func (mm *messageManager) BatchInsertMessages(ctx context.Context, messages []*models.Message) error {
	return mm.db.BatchInsertMessages(ctx, messages)
}

func (mm *messageManager) GetMessages(ctx context.Context, channelName string) ([]*models.Message, error) {
	return mm.db.GetMessages(ctx, channelName)
}
