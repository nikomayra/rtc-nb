package chat

import (
	"context"
	// "encoding/json"
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
	connMgr  connections.Manager
	channels map[string]map[*gorilla_websocket.Conn]bool
}

func NewChannelManager(db *database.Store, connMgr connections.Manager) *channelManager {
	return &channelManager{
		db:       db,
		connMgr:  connMgr,
		channels: make(map[string]map[*gorilla_websocket.Conn]bool),
	}
}

func (cm *channelManager) CreateChannel(ctx context.Context, channel *models.Channel) error {
	// Reduce timeout to 3 seconds
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// Validate before acquiring lock
	if err := channel.Validate(); err != nil {
		return err
	}

	// Start transaction
	tx, err := cm.db.BeginTx(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Create in database
	if err := cm.db.CreateChannel(ctx, channel); err != nil {
		return err
	}

	// Only lock for hub operation
	cm.mu.Lock()
	err = cm.connMgr.InitializeChannel(channel.Name)
	cm.mu.Unlock()
	if err != nil {
		return err
	}

	// updateMsg := &models.Message{
	//     Type: models.TypeChannelUpdate,
	//     Content: models.MessageContent{
	//         ChannelUpdate: &models.ChannelUpdateData{
	//             Action:  "created",
	//             Channel: channel,
	//         },
	//     },
	// }

	// if msgBytes, err := json.Marshal(updateMsg); err == nil {
	//     cm.connMgr.NotifyAll(msgBytes)
	// }

	return tx.Commit()
}

// JoinChannel adds a user to a channel
func (cm *channelManager) JoinChannel(ctx context.Context, channelName, username string, password *string) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

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
		// Leave current channel before joining new one
		if conn, ok := cm.connMgr.GetConnection(username); ok {
			cm.connMgr.RemoveClientFromChannel(currentChannel, conn)
		}
		// if err := cm.db.RemoveChannelMember(ctx, currentChannel, username); err != nil {
		// 	return fmt.Errorf("remove from current channel: %w", err)
		// }
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
	_, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	cm.mu.Lock()
	defer cm.mu.Unlock()

	if conn, ok := cm.connMgr.GetConnection(username); ok {
		cm.connMgr.RemoveClientFromChannel(channelName, conn)
	}
	// if err := cm.db.RemoveChannelMember(ctx, channelName, username); err != nil {
	// 	return fmt.Errorf("remove channel member: %w", err)
	// }
	return nil
}

// GetChannels returns all available channels
func (cm *channelManager) GetChannels(ctx context.Context) ([]*models.Channel, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

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
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	cm.mu.Lock()
	defer cm.mu.Unlock()

	// Check if user is admin
	isAdmin, err := cm.db.IsUserAdmin(ctx, channelName, username)
	if err != nil {
		return fmt.Errorf("failed to check admin status: %w", err)
	}
	if !isAdmin {
		return fmt.Errorf("user is not admin")
	}

	// Start a transaction for the deletion
	tx, err := cm.db.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Delete all channel members first to avoid constraint issues
	if err := cm.db.DeleteChannelMembers(ctx, channelName); err != nil {
		return fmt.Errorf("failed to delete channel members: %w", err)
	}

	// Delete the channel
	if err := cm.db.DeleteChannel(ctx, channelName); err != nil {
		return fmt.Errorf("delete channel: %w", err)
	}

	// Clean up any lingering clients in this channel
	cm.connMgr.RemoveAllClientsFromChannel(channelName)

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (cm *channelManager) UpdateMemberRole(ctx context.Context, channelName, username string, isAdmin bool, updatedBy string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	cm.mu.Lock()
	defer cm.mu.Unlock()

	// Verify updatedBy is an admin
	isUpdaterAdmin, err := cm.db.IsUserAdmin(ctx, channelName, updatedBy)
	if err != nil || !isUpdaterAdmin {
		return fmt.Errorf("unauthorized: only admins can update roles")
	}

	if !isAdmin {
		// Check if this would remove the last admin
		admins, err := cm.db.GetChannelAdmins(ctx, channelName)
		if err != nil {
			return fmt.Errorf("get channel admins: %w", err)
		}
		if len(admins) == 1 && admins[0] == username {
			return fmt.Errorf("cannot remove last admin")
		}
	}

	if username == updatedBy && !isAdmin {
		return fmt.Errorf("cannot self-demote from admin")
	}

	return cm.db.UpdateChannelMemberRole(ctx, channelName, username, isAdmin)
}
