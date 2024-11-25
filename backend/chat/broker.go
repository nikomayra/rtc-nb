package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"rtc-nb/backend/internal/domain"

	"github.com/redis/go-redis/v9"
)

type RedisBroker struct {
	client *redis.Client
	// Track subscriptions for cleanup
	subscriptions map[string]*redis.PubSub
}

func NewRedisBroker(client *redis.Client) *RedisBroker {
	return &RedisBroker{
		client:        client,
		subscriptions: make(map[string]*redis.PubSub),
	}
}

func (rb *RedisBroker) PublishEvent(ctx context.Context, channelID string, event interface{}) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}

	return rb.client.Publish(ctx, channelID, payload).Err()
}

func (rb *RedisBroker) Subscribe(ctx context.Context, channelID string) (<-chan domain.Message, error) {
	pubsub := rb.client.Subscribe(ctx, channelID)

	// Verify subscription
	if _, err := pubsub.Receive(ctx); err != nil {
		return nil, fmt.Errorf("verify subscription: %w", err)
	}

	// Create message channel with buffer
	messageChan := make(chan domain.Message, 100)

	// Start goroutine to handle messages
	go rb.handleMessages(ctx, pubsub.Channel(), messageChan)

	rb.subscriptions[channelID] = pubsub
	return messageChan, nil
}

func (rb *RedisBroker) handleMessages(ctx context.Context, redisMessages <-chan *redis.Message, outChan chan<- domain.Message) {
	defer close(outChan)

	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-redisMessages:
			var message domain.Message
			if err := json.Unmarshal([]byte(msg.Payload), &message); err != nil {
				log.Printf("Error unmarshaling message: %v", err)
				continue
			}

			select {
			case outChan <- message:
			default:
				log.Printf("Warning: message channel full, dropping message")
			}
		}
	}
}

func (rb *RedisBroker) Unsubscribe(ctx context.Context, channelID string) error {
	if pubsub, exists := rb.subscriptions[channelID]; exists {
		if err := pubsub.Unsubscribe(ctx, channelID); err != nil {
			return fmt.Errorf("unsubscribe: %w", err)
		}
		delete(rb.subscriptions, channelID)
	}
	return nil
}
