package chat

import (
	"testing"

	"github.com/go-playground/assert/v2"
)

func TestNewRedisClient(t *testing.T) {
	client := NewRedisClient("redis://localhost:6379")
	assert.Equal(t, client != nil, true) // Assert that the client is initialized
}

// Additional tests can be added for other methods and functionalities
