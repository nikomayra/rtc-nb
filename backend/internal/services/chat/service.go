package chat

import (
	"context"

	// Image packages for decoding
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"

	"rtc-nb/backend/internal/store/database"
	"rtc-nb/backend/internal/store/redis"
	"rtc-nb/backend/internal/store/storage"
	"rtc-nb/backend/internal/websocket"

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
	hub        *websocket.Hub
	cache      *redis.Cache
}

func NewService(dbStore *database.Store, fileStorer storage.FileStorer, hub *websocket.Hub, cache *redis.Cache) *Service {
	return &Service{
		channelManager:    *NewChannelManager(dbStore, hub),
		userManager:       *NewUserManager(dbStore, hub),
		messageManager:    *NewMessageManager(dbStore, hub),
		attachmentManager: *NewAttachmentManager(dbStore, fileStorer),
		dbStore:           dbStore,
		fileStorer:        fileStorer,
		hub:               hub,
		cache:             cache,
	}
}

func (cs *Service) GetUserConnection(username string) (*gorilla_websocket.Conn, bool) {
	return cs.hub.GetConnection(username)
}

// ClearUserSession clears user session data
func (cs *Service) ClearUserSession(ctx context.Context, username string) error {
	if conn, exists := cs.hub.GetConnection(username); exists {
		cs.hub.RemoveConnection(username)
		userChannel, err := cs.dbStore.GetUserChannel(ctx, username)
		if err != nil {
			return err
		}
		cs.hub.RemoveClientFromChannel(userChannel, conn)
	}
	return nil
}
