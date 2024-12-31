package chat

import (
	"context"
	"fmt"
	"sync"
	"time"

	"rtc-nb/backend/internal/auth"
	"rtc-nb/backend/internal/connections"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/internal/store/database"

	gorilla_websocket "github.com/gorilla/websocket"
)

type channelManager struct {
	mu       sync.RWMutex
	db       *database.Store
	connMgr  connections.ConnectionManager
	channels map[string]map[*gorilla_websocket.Conn]bool
}

func NewChannelManager(db *database.Store, connMgr connections.ConnectionManager) *channelManager {
	return &channelManager{
		db:       db,
		connMgr:  connMgr,
		channels: make(map[string]map[*gorilla_websocket.Conn]bool),
	}
}

func (cm *channelManager) CreateChannel(ctx context.Context, channel *models.Channel) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	// 1. Validate channel
	if err := channel.Validate(); err != nil {
		return err
	}

	// 2. Begin transaction
	tx, err := cm.db.BeginTx(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 3. Create in database
	if err := cm.db.CreateChannel(ctx, channel); err != nil {
		return err
	}

	// 4. Initialize websocket hub channel
	err = cm.connMgr.InitializeChannel(channel.Name)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// JoinChannel adds a user to a channel
func (cm *channelManager) JoinChannel(ctx context.Context, channelName, username string, password *string) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	channel, err := cm.db.GetChannel(ctx, channelName)
	if err != nil {
		return fmt.Errorf("get channel: %w", err)
	}
	if channel == nil {
		return fmt.Errorf("channel not found")
	}

	if channel.IsPrivate {
		if password == nil || *password == "" {
			return fmt.Errorf("password required for private channel")
		}
		if channel.HashedPassword == nil {
			return fmt.Errorf("channel configuration error: missing password hash")
		}
		// Verify password using auth package
		if err := auth.CheckPassword(*channel.HashedPassword, *password); err != nil {
			return fmt.Errorf("invalid password")
		}
	}

	currentChannel, err := cm.db.GetUserChannel(ctx, username)
	if err != nil {
		return fmt.Errorf("get user channel: %w", err)
	}

	tx, err := cm.db.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()

	if currentChannel != "" && currentChannel != channelName {
		// Remove from other channels
		if err := cm.db.RemoveChannelMember(ctx, currentChannel, username); err != nil {
			return fmt.Errorf("remove from current channel: %w", err)
		}
		// Remove from websocket channel
		if conn, ok := cm.connMgr.GetConnection(username); ok {
			cm.connMgr.RemoveClientFromChannel(currentChannel, conn)
		}
	}

	if currentChannel != channelName {
		isAdmin, err := cm.db.IsUserAdmin(ctx, channelName, username)
		if err != nil {
			return fmt.Errorf("is user admin: %w", err)
		}

		member := &models.ChannelMember{
			Username: username,
			JoinedAt: time.Now(),
			IsAdmin:  isAdmin,
		}

		if err := cm.db.AddChannelMember(ctx, channelName, member); err != nil {
			return fmt.Errorf("add channel member: %w", err)
		}
	}

	if conn, ok := cm.connMgr.GetConnection(username); ok {
		cm.connMgr.AddClientToChannel(channelName, conn)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// LeaveChannel removes a user from a channel
func (cm *channelManager) LeaveChannel(ctx context.Context, channelName, username string) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if conn, ok := cm.connMgr.GetConnection(username); ok {
		cm.connMgr.RemoveClientFromChannel(channelName, conn)
	}
	if err := cm.db.RemoveChannelMember(ctx, channelName, username); err != nil {
		return fmt.Errorf("remove channel member: %w", err)
	}
	return nil
}

// GetChannels returns all available channels
func (cm *channelManager) GetChannels(ctx context.Context) ([]*models.Channel, error) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	// Get channels from repository
	channels, err := cm.db.GetChannels(ctx)
	if err != nil {
		return nil, fmt.Errorf("get channels: %w", err)
	}

	return channels, nil
}

// DeleteChannel removes a channel if the user is an admin
func (cm *channelManager) DeleteChannel(ctx context.Context, channelName, username string) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if isAdmin, err := cm.db.IsUserAdmin(ctx, channelName, username); err != nil || !isAdmin {
		return fmt.Errorf("user is not admin")
	}
	if err := cm.db.DeleteChannel(ctx, channelName); err != nil {
		return fmt.Errorf("delete channel: %w", err)
	}
	return nil
}
