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
		flushInterval: 500 * time.Millisecond,
		rateLimiter:   utils.NewRateLimiter(100*time.Millisecond, 1),
	}
	go mb.processMessages()
	return mb
}

func (sb *SketchBuffer) Add(msg *models.Message) {
	if !sb.rateLimiter.Allow() {
		log.Printf("WARN: Rate limit exceeded for user %s on sketch buffer. Message ID %s dropped.", msg.Username, msg.ID)
		return
	}
	select {
	case sb.messages <- msg:
	default:
		log.Printf("CRITICAL: Sketch buffer full! Dropping COMPLETE update message for sketch %s from user %s. Message ID: %s", msg.Content.SketchCmd.SketchID, msg.Username, msg.ID)
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
				log.Printf("Flushing sketch buffer due to batch size (%d messages)", len(batch))
				if err := sb.flush(batch); err != nil {
					log.Printf("ERROR during batch size flush completion: %v", err)
				} else {
					log.Printf("Finished flushing sketch batch (size trigger).")
				}
				batch = make([]*models.Message, 0, sb.batchSize)
			}
		case <-ticker.C:
			if len(batch) > 0 {
				log.Printf("Flushing sketch buffer due to interval (%d messages)", len(batch))
				if err := sb.flush(batch); err != nil {
					log.Printf("ERROR during interval flush completion: %v", err)
				} else {
					log.Printf("Finished flushing sketch batch (interval trigger).")
				}
				batch = make([]*models.Message, 0, sb.batchSize)
			}
		}
	}
}

func (sb *SketchBuffer) flush(messages []*models.Message) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	updates := make(map[string][]*models.SketchCommand)
	processedMsgCount := 0

	// Group update commands by sketch ID
	for _, msg := range messages {
		// Basic validation already done in Processor, but double-check here
		if msg.Type != models.MessageTypeSketch ||
			msg.Content.SketchCmd == nil ||
			msg.Content.SketchCmd.CommandType != models.SketchCommandTypeUpdate ||
			msg.Content.SketchCmd.IsPartial == nil || *msg.Content.SketchCmd.IsPartial ||
			msg.Content.SketchCmd.Region == nil {
			log.Printf("WARN: Skipping invalid/non-COMPLETE update message found in sketch buffer flush: MsgID=%s", msg.ID)
			continue
		}

		cmd := msg.Content.SketchCmd
		sketchId := cmd.SketchID
		updates[sketchId] = append(updates[sketchId], cmd)
		processedMsgCount++
	}

	if processedMsgCount == 0 {
		log.Printf("Sketch buffer flush: No valid COMPLETE update messages found in batch of %d.", len(messages))
		return nil
	}

	log.Printf("Processing %d COMPLETE sketch updates across %d unique sketches from batch of %d messages.", processedMsgCount, len(updates), len(messages))

	// Atomically apply updates for each sketch
	var firstError error
	for sketchID, commands := range updates {
		if len(commands) == 0 {
			continue
		}
		log.Printf("Attempting to flush %d update command(s) for sketch %s", len(commands), sketchID)
		if err := sb.sketchService.ApplySketchUpdates(ctx, sketchID, commands); err != nil {
			// Log the error more clearly, mentioning the commands might be lost for this specific sketch
			log.Printf("ERROR: Failed to apply %d update(s) for sketch %s. These updates may be lost. Error: %v", len(commands), sketchID, err)
			if firstError == nil {
				firstError = err
			}
		} else {
			log.Printf("Successfully flushed %d update command(s) for sketch %s", len(commands), sketchID)
		}
	}
	return firstError
}

/* COMMENTED OUT: Old, non-atomic, and incorrect update logic
// Process each sketch's updates
for sketchID, commands := range updates {
	sketch, err := sb.sketchService.GetSketch(ctx, sketchID)
	if err != nil {
		log.Printf("Error getting sketch %s: %v", sketchID, err)
		continue
	}

	// Process each update
	for _, cmd := range commands {
		if cmd.Region == nil {
			continue
		}

		err := sketch.AddRegion(*cmd.Region) // This was overwriting, not merging
		if err != nil {
			log.Printf("Error adding region to sketch %s: %v", sketchID, err)
			continue
		}
	}

	if err := sb.sketchService.UpdateSketch(ctx, sketch); err != nil {
		log.Printf("Error updating sketch: %v", err)
	}
}
*/
