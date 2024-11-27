package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

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

	// TODO: Implement channel joining logic
	// 1. Verify channel exists
	// 2. Check password if required
	// 3. Add user to channel
	// 4. Subscribe to channel events
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
	return nil
}

// IsUserAdmin checks if a user is an admin of a channel
func (cs *ChatService) IsUserAdmin(ctx context.Context, channelName, username string) (bool, error) {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	// TODO: Implement admin check
	return false, nil
}
