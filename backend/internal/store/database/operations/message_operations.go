package operations

import (
	"context"
	"database/sql"
	"rtc-nb/backend/internal/domain"
	"time"
)

type MessageStore struct {
	db        *sql.DB
	batchSize int
	messages  chan *domain.Message
}

func NewMessageStore(db *sql.DB) *MessageStore {
	ms := &MessageStore{
		db:        db,
		batchSize: 100,
		messages:  make(chan *domain.Message, 1000),
	}

	go ms.batchWorker()
	return ms
}

// Save queues message for batch processing
func (ms *MessageStore) Save(ctx context.Context, msg *domain.Message) error {
	select {
	case ms.messages <- msg:
		return nil
	default:
		// If queue is full, fall back to immediate write
		return ms.saveImmediate(ctx, msg)
	}
}

func (ms *MessageStore) batchWorker() {
	batch := make([]*domain.Message, 0, ms.batchSize)
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case msg := <-ms.messages:
			batch = append(batch, msg)
			if len(batch) >= ms.batchSize {
				ms.saveBatch(context.Background(), batch)
				batch = batch[:0]
			}
		case <-ticker.C:
			if len(batch) > 0 {
				ms.saveBatch(context.Background(), batch)
				batch = batch[:0]
			}
		}
	}
}

func (ms *MessageStore) processBatch() {
	for msgs := range ms.batchMessages() {
		if err := ms.persistBatch(msgs); err != nil {
			ms.handleFailure(msgs)
		}
	}
}
