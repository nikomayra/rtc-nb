package messaging

import (
	// "context"
	"log"
	"time"

	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/internal/services/sketch"
)

type SketchBuffer struct {
	messages      chan *models.Message
	sketchService *sketch.Service
	batchSize     int
	flushInterval time.Duration
}

func NewSketchBuffer(sketchService *sketch.Service) *SketchBuffer {
	mb := &SketchBuffer{
		messages:      make(chan *models.Message, 1000),
		sketchService: sketchService,
		batchSize:     10, // TODO: make more realistic for production
		flushInterval: 5 * time.Second,
	}
	go mb.processMessages()
	return mb
}

func (sb *SketchBuffer) Add(msg *models.Message) {
	select {
	case sb.messages <- msg:
	default:
		log.Printf("Failed to add message: buffer full")
	}
}

func (sb *SketchBuffer) processMessages() {
	batch := make([]*models.Message, 0, sb.batchSize)
	ticker := time.NewTicker(sb.flushInterval)
	defer ticker.Stop()

	for {
		select {
		case msg := <-sb.messages:
			batch = append(batch, msg)
			if len(batch) >= sb.batchSize {
				if err := sb.flush(batch); err != nil {
					log.Printf("Error flushing messages: %v", err)
				}
				batch = batch[:0]
			}
		case <-ticker.C:
			if len(batch) > 0 {
				if err := sb.flush(batch); err != nil {
					log.Printf("Error flushing messages: %v", err)
				}
				batch = batch[:0]
			}
		}
	}
}

func (sb *SketchBuffer) flush(messages []*models.Message) error {
	// ctx := context.Background()

	// Batch insert to database
	
	return nil
}
