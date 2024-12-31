package chat

import (
	"context"
	"mime/multipart"

	"rtc-nb/backend/internal/models"

	gorilla_websocket "github.com/gorilla/websocket"
)

type ChatManager interface {

	// Connection operations (Service level operations)
	GetUserConnection(username string) (*gorilla_websocket.Conn, bool)
	ClearUserSession(ctx context.Context, username string) error

	// User operations
	GetUser(ctx context.Context, username string) (*models.User, error)
	CreateUser(ctx context.Context, user *models.User) error
	DeleteUser(ctx context.Context, username string) error

	// Channel operations
	CreateChannel(ctx context.Context, channel *models.Channel) error
	JoinChannel(ctx context.Context, channelName, username string, password *string) error
	LeaveChannel(ctx context.Context, channelName, username string) error
	GetChannels(ctx context.Context) ([]*models.Channel, error)
	DeleteChannel(ctx context.Context, channelName, username string) error

	// File operations
	HandleImageUpload(ctx context.Context, file multipart.File, header *multipart.FileHeader, channelName, username string) (interface{}, error)
	HandleVideoUpload(ctx context.Context, file multipart.File, header *multipart.FileHeader, channelName, username string) (interface{}, error)
	HandleAudioUpload(ctx context.Context, file multipart.File, header *multipart.FileHeader, channelName, username string) (interface{}, error)

	// Message operations
	BatchInsertMessages(ctx context.Context, messages []*models.Message) error
}
