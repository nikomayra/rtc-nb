package redis

import "github.com/redis/go-redis/v9"

type Cache struct {
	redis *redis.Client
}
