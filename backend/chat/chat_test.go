package chat

import (
	"os"
	"rtc-nb/backend/config"
	"testing"

	"github.com/go-playground/assert/v2"
)

func TestNewRedisClient(t *testing.T) {
	config.LoadEnv()
	redisServer := os.Getenv("REDIS_SERVER")
	client := NewRedisClient(redisServer)
	assert.Equal(t, client != nil, true) // Assert that the client is initialized
}

// Additional tests can be added for other methods and functionalities