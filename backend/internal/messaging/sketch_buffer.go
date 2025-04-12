package messaging

import (
	"context"
	"log"
	"log/slog"
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
		// log.Printf("WARN: Rate limit exceeded for user %s on sketch buffer. Message ID %s dropped.", msg.Username, msg.ID)
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
				slog.Debug("Flushing sketch buffer due to batch size", "count", len(batch))
				if err := sb.flush(batch); err != nil {
					// Only log critical error if flush fails
					log.Printf("ERROR during batch size flush completion: %v", err)
				} else {
					slog.Debug("Finished flushing sketch batch (size trigger).")
				}
				batch = make([]*models.Message, 0, sb.batchSize)
			}
		case <-ticker.C:
			if len(batch) > 0 {
				slog.Debug("Flushing sketch buffer due to interval", "count", len(batch))
				if err := sb.flush(batch); err != nil {
					// Only log critical error if flush fails
					log.Printf("ERROR during interval flush completion: %v", err)
				} else {
					slog.Debug("Finished flushing sketch batch (interval trigger).")
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
			// log.Printf("WARN: Skipping invalid/non-COMPLETE update message found in sketch buffer flush: MsgID=%s", msg.ID)
			continue
		}

		cmd := msg.Content.SketchCmd
		sketchId := cmd.SketchID
		updates[sketchId] = append(updates[sketchId], cmd)
		processedMsgCount++
	}

	if processedMsgCount == 0 {
		slog.Debug("Sketch buffer flush: No valid COMPLETE update messages found", "batch_size", len(messages))
		return nil
	}

	slog.Debug("Processing sketch updates", "updates", processedMsgCount, "sketches", len(updates), "batch_size", len(messages))

	// Atomically apply updates for each sketch
	var firstError error
	for sketchID, commands := range updates {
		if len(commands) == 0 {
			continue
		}
		slog.Debug("Attempting to flush sketch updates", "count", len(commands), "sketchID", sketchID)
		if err := sb.sketchService.ApplySketchUpdates(ctx, sketchID, commands); err != nil {
			// This is a critical error, updates might be lost.
			log.Printf("ERROR: Failed to apply %d update(s) for sketch %s. These updates may be lost. Error: %v", len(commands), sketchID, err)
			if firstError == nil {
				firstError = err
			}
		} else {
			slog.Debug("Successfully flushed sketch updates", "count", len(commands), "sketchID", sketchID)
		}
	}
	return firstError
}
