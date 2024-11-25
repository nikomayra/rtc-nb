package chat

import (
	"context"
	"database/sql"
	"log"
	"rtc-nb/backend/internal/domain"
	"rtc-nb/backend/internal/store"
	"rtc-nb/backend/internal/store/redis"
)

type ChatService struct {
	store  *store.Store
	broker *redis.Broker
	state  *StateManager
}

func NewService(store *store.Store, broker *redis.Broker, state *StateManager) *ChatService {
	return &ChatService{
		store:  store,
		broker: broker,
		state:  state,
	}
}

// Example of a high-level operation
func (s *ChatService) SendMessage(ctx context.Context, channelName, username string, content domain.MessageContent) error {
	// 1. Create domain message
	msg, err := domain.NewMessage(channelName, username, content)
	if err != nil {
		return err
	}

	// 2. Queue for batch persistence
	s.store.Message.QueueForBatch(msg)

	// 3. Update in-memory state if needed
	if err := s.state.AddMessage(msg); err != nil {
		log.Printf("Warning: failed to update state: %v", err)
	}

	// 4. Publish to Redis for real-time delivery
	return s.broker.PublishEvent(ctx, channelName, msg)
}

// Example of a transactional operation
func (s *ChatService) CreateChannel(ctx context.Context, name, creator string, isPrivate bool) error {
	channel, err := domain.NewChannel(name, creator, isPrivate)
	if err != nil {
		return err
	}

	return s.store.WithinTx(ctx, func(tx *sql.Tx) error {
		// 1. Persist to database
		if err := s.store.Channel.Create(ctx, tx, channel); err != nil {
			return err
		}

		// 2. Update in-memory state
		if err := s.state.AddChannel(channel); err != nil {
			return err
		}

		// 3. Set up Redis subscription
		return s.broker.Subscribe(ctx, channel.Name)
	})
}
