package redis

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

// Redis cache utilities (get/set)
type Cache struct {
	redis *redis.Client
}

func NewCache(redis *redis.Client) *Cache {
	return &Cache{redis: redis}
}

func (c *Cache) Get(ctx context.Context, key string) (string, error) {
	return c.redis.Get(ctx, key).Result()
}

func (c *Cache) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return c.redis.Set(ctx, key, value, expiration).Err()
}
