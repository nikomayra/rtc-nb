package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"rtc-nb/backend/internal/auth"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/internal/repositories"
	"rtc-nb/backend/internal/store/redis"
	"rtc-nb/backend/internal/websocket"
)

type ChatService struct {
	mu     sync.RWMutex
	repo   *repositories.Repository
	pubsub *redis.PubSub
	hub    *websocket.Hub
}

func NewService(repo *repositories.Repository, pubsub *redis.PubSub, hub *websocket.Hub) *ChatService {
	return &ChatService{
		repo:   repo,
		pubsub: pubsub,
		hub:    hub,
	}
}

// User operations
func (cs *ChatService) GetUser(ctx context.Context, username string) (*models.User, error) {
	cs.mu.RLock()
	defer cs.mu.RUnlock()
	return cs.repo.GetUser(ctx, username)
}

func (cs *ChatService) CreateUser(ctx context.Context, user *models.User) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()
	return cs.repo.CreateUser(ctx, user)
}

// Channel operations
func (cs *ChatService) CreateChannel(ctx context.Context, channel *models.Channel) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	if err := cs.repo.CreateChannel(ctx, channel); err != nil {
		return err
	}

	// Subscribe to channel events
	go func() {
		msgChan, err := cs.pubsub.Subscribe(context.Background(), channel.Name)
		if err != nil {
			// TODO: proper error handling for background task
			return
		}

		for msg := range msgChan {
			// TODO: handle incoming messages
			_ = msg
		}
	}()

	return nil
}

// Message operations
func (cs *ChatService) SendMessage(ctx context.Context, msg *models.Message) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	// 1. Publish to Redis for real-time delivery
	if err := cs.pubsub.Publish(ctx, msg.ChannelName, msg); err != nil {
		return fmt.Errorf("redis publish: %w", err)
	}

	// 2. Notify websocket clients
	msgBytes, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal message: %w", err)
	}
	cs.hub.NotifyChannel(msg.ChannelName, msgBytes)

	// TODO: 3. Persist message to database
	return nil
}

// JoinChannel adds a user to a channel
func (cs *ChatService) JoinChannel(ctx context.Context, channelName, username string, password *string) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	// 1. Verify channel exists and check password
	channel, err := cs.repo.GetChannel(ctx, channelName)
	if err != nil {
		return fmt.Errorf("get channel: %w", err)
	}
	if channel == nil {
		return fmt.Errorf("channel not found")
	}

	// Check password for private channels
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

	// 2. Get current channel membership (if any)
	currentChannels, err := cs.repo.GetUserChannels(ctx, username)
	if err != nil {
		return fmt.Errorf("get user channels: %w", err)
	}

	// 3. Start a transaction for membership changes
	tx, err := cs.repo.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Check if user is already in the target channel
	isCurrentMember := false
	for _, currentChannel := range currentChannels {
		if currentChannel == channelName {
			isCurrentMember = true
			continue
		}
		// Remove from other channels
		if err := cs.repo.RemoveChannelMember(ctx, currentChannel, username); err != nil {
			return fmt.Errorf("remove from current channel: %w", err)
		}
		// Remove from websocket channel
		if conn, ok := cs.hub.GetConnection(username); ok {
			cs.hub.RemoveClientFromChannel(currentChannel, conn)
		}
	}

	isAdmin, err := cs.repo.IsUserAdmin(ctx, channelName, username)
	if err != nil {
		return fmt.Errorf("is user admin: %w", err)
	}

	if !isCurrentMember {
		member := &models.ChannelMember{
			Username: username,
			JoinedAt: time.Now(),
			IsAdmin:  isAdmin,
		}

		if err := cs.repo.AddChannelMember(ctx, channelName, member); err != nil {
			return fmt.Errorf("add channel member: %w", err)
		}
	}

	// 6. Add to websocket channel
	if conn, ok := cs.hub.GetConnection(username); ok {
		cs.hub.AddClientToChannel(channelName, conn)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// LeaveChannel removes a user from a channel
func (cs *ChatService) LeaveChannel(ctx context.Context, channelName, username string) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	// TODO: Implement channel leaving logic
	// 1. Verify user is in channel
	// 2. Remove user from channel
	// 3. Unsubscribe from channel events
	if conn, ok := cs.hub.GetConnection(username); ok {
		cs.hub.RemoveClientFromChannel(channelName, conn)
	}
	if err := cs.repo.RemoveChannelMember(ctx, channelName, username); err != nil {
		return fmt.Errorf("remove channel member: %w", err)
	}
	return nil
}

// GetChannels returns all available channels
func (cs *ChatService) GetChannels(ctx context.Context) ([]*models.Channel, error) {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	// Get channels from repository
	channels, err := cs.repo.GetChannels(ctx)
	if err != nil {
		return nil, fmt.Errorf("get channels: %w", err)
	}

	return channels, nil
}

// DeleteChannel removes a channel if the user is an admin
func (cs *ChatService) DeleteChannel(ctx context.Context, channelName, username string) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	// TODO: Implement channel deletion logic
	// 1. Verify channel exists
	// 2. Verify user is admin
	// 3. Delete channel
	// 4. Notify all members
	// 5. Clean up subscriptions
	if isAdmin, err := cs.repo.IsUserAdmin(ctx, channelName, username); err != nil || !isAdmin {
		return fmt.Errorf("user is not admin")
	}
	if err := cs.repo.DeleteChannel(ctx, channelName); err != nil {
		return fmt.Errorf("delete channel: %w", err)
	}
	return nil
}
