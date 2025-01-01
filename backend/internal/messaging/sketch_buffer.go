package messaging

import (
	// "context"
	"context"
	// "fmt"
	"log"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/internal/services/sketch"
	"rtc-nb/backend/pkg/utils"
	"time"
)

type SketchBuffer struct {
	messages      chan *models.Message
	sketchService *sketch.Service
	batchSize     int
	flushInterval time.Duration
	rateLimiter   *utils.RateLimiter
}

func NewSketchBuffer(sketchService *sketch.Service) *SketchBuffer {
	mb := &SketchBuffer{
		messages:      make(chan *models.Message, 1000),
		sketchService: sketchService,
		batchSize:     10, // TODO: make more realistic for production
		flushInterval: 5 * time.Second,
		rateLimiter:   utils.NewRateLimiter(100*time.Millisecond, 1),
	}
	go mb.processMessages()
	return mb
}

func (sb *SketchBuffer) Add(msg *models.Message) {
	if !sb.rateLimiter.Allow() {
		log.Printf("Rate limit exceeded for user %s", msg.Username)
		return
	}
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
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
    updates := make(map[string][]models.SketchUpdate)
    
    // Group updates by sketch ID
    for _, msg := range messages {
		if msg.Content.SketchUpdate == nil {
			continue
		}
        updates[msg.Content.SketchUpdate.SketchID] = append(updates[msg.Content.SketchUpdate.SketchID], *msg.Content.SketchUpdate)
    }
    
    // Process each sketch's updates
    for sketchID, sketchUpdates := range updates {
        sketch, err := sb.sketchService.GetSketch(ctx, sketchID)
        if err != nil {
			log.Printf("Error getting sketch %s: %v", sketchID, err)
            continue
        }
        
        // Process each update
        for _, update := range sketchUpdates {
            err := sketch.AddRegion(update.Region)
            if err != nil {
                log.Printf("Error adding region to sketch %s: %v", sketchID, err)
                continue
            }
        }
        
        if err := sb.sketchService.UpdateSketch(ctx, sketch); err != nil {
            log.Printf("Error updating sketch: %v", err)
        }
    }
	return nil
}