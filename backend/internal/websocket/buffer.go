package websocket

import (
	"context"
	"log"
	"time"

	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/internal/store/database"
)

type MessageBuffer struct {
	messages      chan *models.Message
	db            *database.Store
	batchSize     int
	flushInterval time.Duration
}

func NewMessageBuffer(db *database.Store) *MessageBuffer {
	mb := &MessageBuffer{
		messages:      make(chan *models.Message, 1000),
		db:            db,
		batchSize:     10, // TODO: make more realistic for production
		flushInterval: 1 * time.Second,
	}
	go mb.processMessages()
	return mb
}

func (mb *MessageBuffer) Add(msg *models.Message) {
	select {
	case mb.messages <- msg:
	default:
		log.Printf("Failed to add message: buffer full")
	}
}

func (mb *MessageBuffer) processMessages() {
	batch := make([]*models.Message, 0, mb.batchSize)
	ticker := time.NewTicker(mb.flushInterval)
	defer ticker.Stop()

	for {
		select {
		case msg := <-mb.messages:
			batch = append(batch, msg)
			if len(batch) >= mb.batchSize {
				if err := mb.flush(batch); err != nil {
					log.Printf("Error flushing messages: %v", err)
				}
				batch = batch[:0]
			}
		case <-ticker.C:
			if len(batch) > 0 {
				if err := mb.flush(batch); err != nil {
					log.Printf("Error flushing messages: %v", err)
				}
				batch = batch[:0]
			}
		}
	}
}

func (mb *MessageBuffer) flush(messages []*models.Message) error {
	ctx := context.Background()

	// Batch insert to database
	if err := mb.db.BatchInsertMessages(ctx, messages); err != nil {
		return err
	}
	return nil
}
