package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"rtc-nb/backend/internal/domain"

	"github.com/redis/go-redis/v9"
)

type MessageBroker struct {
	client *redis.Client
	// Track subscriptions for cleanup
	subscriptions map[string]*redis.PubSub
}

func NewMessageBroker(client *redis.Client) *MessageBroker {
	return &MessageBroker{
		client:        client,
		subscriptions: make(map[string]*redis.PubSub),
	}
}

func (mb *MessageBroker) PublishEvent(ctx context.Context, channelID string, event interface{}) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}

	return mb.client.Publish(ctx, channelID, payload).Err()
}

func (mb *MessageBroker) Subscribe(ctx context.Context, channelID string) (<-chan domain.Message, error) {
	pubsub := mb.client.Subscribe(ctx, channelID)

	// Verify subscription
	if _, err := pubsub.Receive(ctx); err != nil {
		return nil, fmt.Errorf("verify subscription: %w", err)
	}

	// Create message channel with buffer
	messageChan := make(chan domain.Message, 100)

	// Start goroutine to handle messages
	go mb.handleMessages(ctx, pubsub.Channel(), messageChan)

	mb.subscriptions[channelID] = pubsub
	return messageChan, nil
}

func (mb *MessageBroker) handleMessages(ctx context.Context, redisMessages <-chan *redis.Message, outChan chan<- domain.Message) {
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

func (mb *MessageBroker) Unsubscribe(ctx context.Context, channelID string) error {
	if pubsub, exists := mb.subscriptions[channelID]; exists {
		if err := pubsub.Unsubscribe(ctx, channelID); err != nil {
			return fmt.Errorf("unsubscribe: %w", err)
		}
		delete(mb.subscriptions, channelID)
	}
	return nil
}
