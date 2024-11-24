package chat

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"rtc-nb/backend/internal/database"
	"rtc-nb/backend/internal/events"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/redismanager"
	"rtc-nb/backend/websocket/connection"

	"github.com/go-redis/redis"
	"github.com/gorilla/websocket"
)

type ChatServer struct {
	mu                sync.Mutex
	activeUsers       map[string]*models.User    // username -> user state
	channels          map[string]*models.Channel // channelName -> channel
	messageBuffer     map[string]*models.Message // channelName -> recent messages
	connectionManager *connection.ConnectionManager

	redisClient *redismanager.RedisClient

	persistQueue chan persistOperation
	eventQueue   chan events.ChannelEvent
}

type persistOperation struct {
	opType    string // "message", "channel_create", "channel_delete", etc.
	data      interface{}
	timestamp time.Time
}

func NewChatServer(redisClient *redismanager.RedisClient, connectionManager *connection.ConnectionManager) *ChatServer {
	cs := &ChatServer{
		redisClient:       redisClient,
		connectionManager: connectionManager,
		persistQueue:      make(chan persistOperation, 1000),
		eventQueue:        make(chan events.ChannelEvent, 1000),
	}

	go cs.persistWorker()
	go cs.eventWorker()
	go cs.loadInitialState()

	return cs
}

func (cs *ChatServer) loadInitialState() {
	channels, err := database.GetChannels()
	if err != nil {
		log.Printf("Failed to load initial state: %v", err)
	}

	for _, channel := range channels {
		cs.channels[channel.Name] = channel
		if err := cs.subscribeToChannel(channel.Name); err != nil {
			log.Printf("Failed to subscribe to redis channel %s: %v", channel.Name, err)
		}
	}
}

func (cs *ChatServer) subscribeToChannel(channelName string) error {
	subChannel, err := cs.redisClient.Subscribe(channelName)
	if err != nil {
		return fmt.Errorf("error subscribing to redis channel %s: %v", channelName, err)
	}

	go cs.handleRedisSubscription(subChannel)
	return nil
}

func (cs *ChatServer) handleRedisSubscription(messages <-chan *redis.Message) {
	for msg := range messages {
		var message models.Message
		if err := json.Unmarshal([]byte(msg.Payload), &message); err != nil {
			log.Printf("Failed to unmarshal redis message: %v", err)
			continue
		}

		cs.mu.RLock()
		channel, exists := cs.channels[message.ChannelName]
		cs.mu.RUnlock()

		if !exists {
			log.Printf("Received message for non-existent channel: %s", message.ChannelName)
			continue
		}

		for username := range channel.GetMembers() {
			if conn, ok := cs.connectionManager.GetConnection(username); ok {
				messageJSON, err := json.Marshal(message)
				if err != nil {
					log.Printf("Failed to marshal message for websocket: %v", err)
					continue
				}

				if err := conn.WriteMessage(websocket.TextMessage, messageJSON); err != nil {
					log.Printf("Failed to send message to user %s: %v", username, err)
				}
			}
		}
	}
}

func (cs *ChatServer) HandleWebsocketMessage(message *models.Message) error {

	if err := message.Content.Validate(); err != nil {
		return fmt.Errorf("invalid message: %w", err)
	}

	if err := database.SaveMessage(message); err != nil {
		return fmt.Errorf("failed to save message: %w", err)
	}

	cs.mu.RLock()
	channel, exists := cs.channels[message.ChannelName]
	cs.mu.RUnlock()

	if exists {
		if err := channel.UpdateLastMessage(message.Username); err != nil {
			log.Printf("Failed to update last message time: %v", err)
		}
	}

	messageJSON, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	if err := cs.redisClient.Publish(message.ChannelName, string(messageJSON)); err != nil {
		return fmt.Errorf("failed to publish message: %w", err)
	}

	return nil
}

// func (cs *ChatServer) IsUserAdmin(channelName, username string) (bool, error) {
// 	channel, exists := cs.channels[channelName]
// 	if !exists {
// 		return false, fmt.Errorf("channel %s does not exist", channelName)
// 	}
// 	return channel.IsAdmin(username), nil
// }
