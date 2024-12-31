package messaging

import (
	"context"
	"log"
	"time"

	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/internal/services/chat"
)

type ChatBuffer struct {
	messages      chan *models.Message
	chatService   *chat.Service
	batchSize     int
	flushInterval time.Duration
}

func NewChatBuffer(chatService *chat.Service) *ChatBuffer {
	mb := &ChatBuffer{
		messages:      make(chan *models.Message, 1000),
		chatService:   chatService,
		batchSize:     10, // TODO: make more realistic for production
		flushInterval: 1 * time.Second,
	}
	go mb.processMessages()
	return mb
}

func (cb *ChatBuffer) Add(msg *models.Message) {
	select {
	case cb.messages <- msg:
	default:
		log.Printf("Failed to add message: buffer full")
	}
}

func (cb *ChatBuffer) processMessages() {
	batch := make([]*models.Message, 0, cb.batchSize)
	ticker := time.NewTicker(cb.flushInterval)
	defer ticker.Stop()

	for {
		select {
		case msg := <-cb.messages:
			batch = append(batch, msg)
			if len(batch) >= cb.batchSize {
				if err := cb.flush(batch); err != nil {
					log.Printf("Error flushing messages: %v", err)
				}
				batch = batch[:0]
			}
		case <-ticker.C:
			if len(batch) > 0 {
				if err := cb.flush(batch); err != nil {
					log.Printf("Error flushing messages: %v", err)
				}
				batch = batch[:0]
			}
		}
	}
}

func (cb *ChatBuffer) flush(messages []*models.Message) error {
	ctx := context.Background()

	// Batch insert to database
	if err := cb.chatService.BatchInsertMessages(ctx, messages); err != nil {
		return err
	}
	return nil
}
