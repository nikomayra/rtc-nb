package chat

import (
	"context"
	"database/sql"
	"log"
	"rtc-nb/backend/internal/database/operations"
	"rtc-nb/backend/internal/domain"
)

type ChatService struct {
	channelRepo *operations.ChannelRepository
	messageRepo *operations.MessageRepository
	broker      *MessageBroker
	state       *MemoryStateManager
}

// Example of a high-level operation
func (s *ChatService) SendMessage(ctx context.Context, channelName, username string, content domain.MessageContent) error {
	// 1. Create domain message
	msg, err := domain.NewMessage(channelName, username, content)
	if err != nil {
		return err
	}

	// 2. Queue for batch persistence
	s.messageRepo.QueueForBatch(msg)

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

	return s.txManager.WithinTx(ctx, func(tx *sql.Tx) error {
		// 1. Persist to database
		if err := s.channelRepo.Create(ctx, tx, channel); err != nil {
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
