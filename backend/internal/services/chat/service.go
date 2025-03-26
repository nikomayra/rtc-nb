package chat

import (
	"context"
	"time"

	// Image packages for decoding
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"

	"rtc-nb/backend/internal/connections"
	"rtc-nb/backend/internal/store/database"
	"rtc-nb/backend/internal/store/storage"

	gorilla_websocket "github.com/gorilla/websocket"
)

// const (
// 	maxImageSize = 2 << 20 // 2MB
// 	maxVideoSize = 8 << 20 // 8MB
// 	maxAudioSize = 5 << 20 // 5MB
// )

type Service struct {
	channelManager
	userManager
	messageManager
	attachmentManager
	dbStore    *database.Store
	fileStorer storage.FileStorer
	connMgr    connections.Manager
}

func NewService(dbStore *database.Store, fileStorer storage.FileStorer, connMgr connections.Manager) *Service {
	return &Service{
		channelManager:    *NewChannelManager(dbStore, connMgr),
		userManager:       *NewUserManager(dbStore),
		messageManager:    *NewMessageManager(dbStore, connMgr),
		attachmentManager: *NewAttachmentManager(dbStore, fileStorer),
		dbStore:           dbStore,
		fileStorer:        fileStorer,
		connMgr:           connMgr,
	}
}

func (cs *Service) GetUserConnection(username string) (*gorilla_websocket.Conn, bool) {
	return cs.connMgr.GetConnection(username)
}

// ClearUserSession clears user session data
func (cs *Service) ClearUserSession(ctx context.Context, username string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if conn, exists := cs.connMgr.GetConnection(username); exists {
		cs.connMgr.RemoveConnection(username)
		userChannel, err := cs.dbStore.GetUserChannel(ctx, username)
		if err != nil {
			return err
		}
		cs.connMgr.RemoveClientFromChannel(userChannel, conn)
	}
	return nil
}
