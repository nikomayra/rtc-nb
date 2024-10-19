package chat

// Redis connection and pub/sub logic

import (
	"context"
	"log"

	"github.com/redis/go-redis/v9"
)

var ctx = context.Background()

type RedisClient struct {
	client *redis.Client
}

// Connects to Redis and returns a client
func NewRedisClient(addr string) *RedisClient {
    opts, err := redis.ParseURL(addr)
    if err != nil {
        log.Println(err)
    }
	rdb := redis.NewClient(opts)

    return &RedisClient{client: rdb}
}

func (r *RedisClient) Subscribe(channel string) (<-chan *redis.Message, error) {
	pubsub := r.client.Subscribe(ctx, channel)
	return pubsub.Channel(), nil
}

func (r *RedisClient) Publish(channel string, messsage string) error {
	return r.client.Publish(ctx, channel, messsage).Err()
}
