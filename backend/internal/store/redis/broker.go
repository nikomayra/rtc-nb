package redis

import (
	"context"
	"fmt"
	"log"
	"rtc-nb/backend/internal/models"

	goRedis "github.com/redis/go-redis/v9"
)

// Manages Pub/Sub interactions
type Broker struct {
	client        *goRedis.Client
	subscriptions map[string]*goRedis.PubSub
}

func NewBroker(addr string) *Broker {

	opts, err := goRedis.ParseURL(addr)
	if err != nil {
		log.Println(err)
	}
	rdb := goRedis.NewClient(opts)

	return &Broker{
		client:        rdb,
		subscriptions: make(map[string]*goRedis.PubSub),
	}
}

func (b *Broker) Subscribe(ctx context.Context, channelID string) (<-chan models.Message, error) {
	pubsub := b.client.Subscribe(ctx, channelID)

	// Verify subscription
	if _, err := pubsub.Receive(ctx); err != nil {
		return nil, fmt.Errorf("verify subscription: %w", err)
	}

	// Create message channel with buffer
	messageChan := make(chan models.Message, 100)

	// Start goroutine to handle messages
	go b.handleMessages(ctx, pubsub.Channel(), messageChan)

	b.subscriptions[channelID] = pubsub
	return messageChan, nil
}

func (b *Broker) Unsubscribe(ctx context.Context, channelID string) error {
	if pubsub, exists := b.subscriptions[channelID]; exists {
		if err := pubsub.Unsubscribe(ctx, channelID); err != nil {
			return fmt.Errorf("unsubscribe: %w", err)
		}
		delete(b.subscriptions, channelID)
	}
	return nil
}

// func (b *Broker) PublishEvent(ctx context.Context, channelID string, event interface{}) error {
// 	payload, err := json.Marshal(event)
// 	if err != nil {
// 		return fmt.Errorf("marshal event: %w", err)
// 	}

// 	return b.client.Publish(ctx, channelID, payload).Err()
// }

// func (b *Broker) handleMessages(ctx context.Context, redisMessages <-chan *goRedis.Message, outChan chan<- domain.Message) {
// 	defer close(outChan)

// 	for {
// 		select {
// 		case <-ctx.Done():
// 			return
// 		case msg := <-redisMessages:
// 			var message domain.Message
// 			if err := json.Unmarshal([]byte(msg.Payload), &message); err != nil {
// 				log.Printf("Error unmarshaling message: %v", err)
// 				continue
// 			}

// 			select {
// 			case outChan <- message:
// 			default:
// 				log.Printf("Warning: message channel full, dropping message")
// 			}
// 		}
// 	}
// }
