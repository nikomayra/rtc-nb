package core

import (
	"context"
	"time"
)

// Event represents any state-changing operation
type Event interface {
	Type() string
	Payload() interface{}
	Timestamp() time.Time
}

// PersistenceStrategy defines how different types of data are persisted
type PersistenceStrategy interface {
	// Immediate persistence with transaction support
	PersistTransactional(ctx context.Context, events ...Event) error

	// Batch persistence for high-frequency events
	QueueForBatch(event Event) error

	// Cache operations
	CacheSet(key string, value interface{}, expiration time.Duration) error
	CacheGet(key string) (interface{}, error)

	// Cleanup
	Close() error
}

// StateManager handles in-memory state
type StateManager interface {
	UpdateState(event Event) error
	GetChannelState(channelID string) (*ChannelState, error)
	GetUserState(userID string) (*UserState, error)
}

// MessageBroker handles real-time message distribution
type MessageBroker interface {
	Publish(channel string, message interface{}) error
	Subscribe(channel string) (<-chan Message, error)
	Unsubscribe(channel string) error
}
