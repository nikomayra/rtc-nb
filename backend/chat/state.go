package chat

import (
	"fmt"
	"rtc-nb/backend/internal/core"
	"rtc-nb/backend/internal/models"
	"sync"
)

type MemoryState struct {
	mu       sync.RWMutex
	channels map[string]*models.Channel
	// Optional: Add LRU cache for recent messages
	messageCache *MessageCache
}

type MessageCache struct {
	mu      sync.RWMutex
	cache   map[string][]models.Message // channelName -> recent messages
	maxSize int
}

func NewMemoryState(messageCacheSize int) *MemoryState {
	return &MemoryState{
		channels: make(map[string]*models.Channel),
		messageCache: &MessageCache{
			cache:   make(map[string][]models.Message),
			maxSize: messageCacheSize,
		},
	}
}

func (ms *MemoryState) UpdateState(event core.Event) error {
	ms.mu.Lock()
	defer ms.mu.Unlock()

	switch evt := event.(type) {
	case *ChannelCreateEvent:
		return ms.handleChannelCreate(evt)
	case *ChannelDeleteEvent:
		return ms.handleChannelDelete(evt)
	case *MessageEvent:
		return ms.handleMessage(evt)
	default:
		return fmt.Errorf("unsupported state event: %T", event)
	}
}

func (ms *MemoryState) handleChannelCreate(evt *ChannelCreateEvent) error {
	if _, exists := ms.channels[evt.Channel.Name]; exists {
		return fmt.Errorf("channel already exists: %s", evt.Channel.Name)
	}
	ms.channels[evt.Channel.Name] = evt.Channel
	return nil
}
