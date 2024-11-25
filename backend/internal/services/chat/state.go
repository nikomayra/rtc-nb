package chat

import (
	"fmt"
	"rtc-nb/backend/chat/events"
	"rtc-nb/backend/internal/core"
	"rtc-nb/backend/internal/domain"
	"rtc-nb/backend/internal/models"
	"sync"
)

type StateManager struct {
	mu       sync.RWMutex
	channels map[string]*models.Channel
	messageCache *MessageCache
}

type MessageCache struct {
	mu      sync.RWMutex
	cache   map[string][]models.Message // channelName -> recent messages
	maxSize int                         // max number of messages to keep per channel
}

func NewStateManager(messageCacheSize int) *StateManager {
	return &StateManager{
		channels: make(map[string]*models.Channel),
		messageCache: &MessageCache{
			cache:   make(map[string][]models.Message),
			maxSize: messageCacheSize,
		},
	}
}

func (msm *MemoryStateManager) UpdateState(event core.Event) error {
	msm.mu.Lock()
	defer msm.mu.Unlock()

	switch event.Type() {
	case :
		return msm.handleChannelCreate(evt)
	case *events.ChannelDeleteEvent:
		return msm.handleChannelDelete(evt)
	case *events.MessageEvent:
		return msm.handleMessage(evt)
	default:
		return fmt.Errorf("unsupported state event: %T", event)
	}
}

func (msm *MemoryStateManager) handleChannelCreate(evt *events.ChannelCreateEvent) error {
	if _, exists := msm.channels[evt.Channel.Name]; exists {
		return fmt.Errorf("channel already exists: %s", evt.Channel.Name)
	}
	msm.channels[evt.Channel.Name] = evt.Channel
	return nil
}

func (msm *MemoryStateManager) handleChannelDelete(evt *events.ChannelDeleteEvent) error {
	delete(msm.channels, evt.ChannelName)
	return nil
}

func (msm *MemoryStateManager) handleMessage(evt *events.MessageEvent) error {
	msm.messageCache.AddMessage(evt.ChannelID, evt.Message)
	return nil
}

func (mc *MessageCache) AddMessage(channelName string, message *domain.Message) {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	mc.cache[channelName] = append(mc.cache[channelName], message)
}
