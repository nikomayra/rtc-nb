package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"rtc-nb/backend/internal/models"

	goRedis "github.com/redis/go-redis/v9"
)

type PubSub struct {
	client *goRedis.Client
}

func NewPubSub(client *goRedis.Client) *PubSub {
	return &PubSub{client: client}
}

func (ps *PubSub) Subscribe(ctx context.Context, channel string) (<-chan *models.Message, error) {
	pubsub := ps.client.Subscribe(ctx, channel)

	// Verify subscription
	if _, err := pubsub.Receive(ctx); err != nil {
		return nil, fmt.Errorf("verify subscription: %w", err)
	}

	// Create buffered channel for messages
	messages := make(chan *models.Message, 100)

	// Handle messages in background
	go func() {
		defer pubsub.Close()
		defer close(messages)

		for msg := range pubsub.Channel() {
			var message models.Message
			if err := json.Unmarshal([]byte(msg.Payload), &message); err != nil {
				log.Printf("Error unmarshaling message: %v", err)
				continue
			}
			select {
			case messages <- &message:
			case <-ctx.Done():
				return
			}
		}
	}()

	return messages, nil
}

func (ps *PubSub) Publish(ctx context.Context, channel string, message *models.Message) error {
	data, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("marshal message: %w", err)
	}

	return ps.client.Publish(ctx, channel, data).Err()
}
