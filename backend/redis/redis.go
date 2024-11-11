package redis

import (
	"context"
	"fmt"
	"log"
	"sync"

	"github.com/redis/go-redis/v9"
)

var ctx = context.Background()

type RedisClient struct {
	client        *redis.Client
	subscriptions map[string]*redis.PubSub
	mutex         sync.Mutex
}

// Connects to Redis and returns a client
func NewRedisClient(addr string) *RedisClient {
	opts, err := redis.ParseURL(addr)
	if err != nil {
		log.Println(err)
	}
	rdb := redis.NewClient(opts)

	return &RedisClient{
		client:        rdb,
		subscriptions: make(map[string]*redis.PubSub),
	}
}

func (r *RedisClient) Subscribe(channel string) (<-chan *redis.Message, error) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	sub := r.client.Subscribe(ctx, channel)
	if _, err := sub.Receive(ctx); err != nil {
		return nil, fmt.Errorf("failed to subscribe to channel %s: %v", channel, err)
	}

	r.subscriptions[channel] = sub
	return sub.Channel(), nil
}

func (r *RedisClient) UnSubscribe(channel string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	sub, exists := r.subscriptions[channel]
	if !exists {
		return fmt.Errorf("no subscription found for channel %s", channel)
	}

	if err := sub.Unsubscribe(ctx, channel); err != nil {
		return fmt.Errorf("failed to unsubscribe from channel %s: %v", channel, err)
	}

	delete(r.subscriptions, channel)
	return nil
}

func (r *RedisClient) Publish(channel string, messsage string) error {
	return r.client.Publish(ctx, channel, messsage).Err()
}
