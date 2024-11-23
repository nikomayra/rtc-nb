package chat

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"

	"rtc-nb/backend/internal/auth"
	"rtc-nb/backend/internal/database"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/redis"
	"rtc-nb/backend/websocket/connection"

	"github.com/gorilla/websocket"
)

type ChatServer struct {
	redisClient       *redis.RedisClient
	connectionManager *connection.ConnectionManager

	mu       sync.RWMutex
	channels map[string]*models.Channel // channelName -> channel
}

// NewChatServer initializes a new ChatServer
func NewChatServer(redisClient *redis.RedisClient, connectionManager *connection.ConnectionManager) *ChatServer {
	cs := &ChatServer{
		redisClient:       redisClient,
		connectionManager: connectionManager,
		channels:          make(map[string]*models.Channel),
	}

	return cs
}

func (cs *ChatServer) CreateChannel(name, creatorUsername string, description, password *string) (*models.Channel, error) {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	if _, exists := cs.channels[name]; exists {
		return nil, fmt.Errorf("channel %s already exists ", name)
	}

	var hashedPassword *string
	if password != nil {
		hashed, err := auth.HashPassword(*password)
		if err != nil {
			return nil, fmt.Errorf("failed to hash password: %w", err)
		}
		hashedPassword = &hashed
	}

	channel, err := models.NewChannel(name, creatorUsername, description, hashedPassword)
	if err != nil {
		return nil, fmt.Errorf("error creating channel: %w", err)
	}

	if err := database.CreateChannel(channel); err != nil {
		return nil, fmt.Errorf("error creating channel in database: %w", err)
	}

	subChannel, err := cs.redisClient.Subscribe(channel.Name)
	if err != nil {
		return nil, fmt.Errorf("error subscribing to redis channel %s: %v", channel.Name, err)
	}

	go cs.handleRedisSubscription(subChannel)

	cs.channels[name] = channel

	log.Printf("Created channel %s", name)
	return channel, nil
}

func (cs *ChatServer) handleRedisSubscription(messages <-chan redis.Message) {
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

// func (cs *ChatServer) handleRedisMessage(messageJSON string) {

// 	var message models.Message
// 	if err := json.Unmarshal([]byte(messageJSON), &message); err != nil {
// 		log.Println("Error unmarshaling Redis message:", err)
// 		return
// 	}
// 	//log.Printf("Users in channel %s: %v", message.ChannelName, cs.channels[message.ChannelName].Users)
// 	for _, username := range cs.channels[message.ChannelName].Users {
// 		if conn, ok := cs.connectionManager.GetConnection(username); ok {
// 			messageToSend, err := json.Marshal(message)
// 			if err != nil {
// 				log.Println("Error marshaling message for WebSocket:", err)
// 				continue
// 			}
// 			if err := conn.WriteMessage(websocket.TextMessage, messageToSend); err != nil {
// 				log.Printf("Error writing message to client %s: %v", username, err)
// 			}
// 			//log.Printf("Sent message to client %s: %s", username, messageToSend)
// 		}
// 	}
// }

func (cs *ChatServer) JoinChannel(username, channelName string, password *string) error {
	cs.mu.RLock()
	channel, exists := cs.channels[channelName]
	cs.mu.RUnlock()

	if !exists {
		return fmt.Errorf("channel %s does not exist", channelName)
	}

	if password != nil && !channel.ValidatePassword(*password) {
		return fmt.Errorf("invalid channel password")
	}

	isAdmin := channel.IsAdmin(username)

	if err := channel.AddMember(username, isAdmin); err != nil {
		return fmt.Errorf("error adding member to channel: %w", err)
	}

	if err := database.AddUserToChannel(channelName, username, isAdmin); err != nil {
		channel.RemoveMember(username)
		return fmt.Errorf("error adding member to channel in database: %w", err)
	}

	log.Printf("User: %s, joined channel %s.\n", username, channelName)

	return nil
}

func (cs *ChatServer) LeaveChannel(username, channelName string) error {
	cs.mu.RLock()
	channel, exists := cs.channels[channelName]
	cs.mu.RUnlock()

	if !exists {
		return fmt.Errorf("channel %s does not exist", channelName)
	}

	if err := channel.RemoveMember(username); err != nil {
		return fmt.Errorf("failed to remove member: %w", err)
	}

	if err := database.RemoveUserFromChannel(channelName, username); err != nil {
		log.Printf("Failed to remove user from database: %v", err)
	}

	return nil
}

func (cs *ChatServer) DeleteChannel(channelName, username string) error {
	cs.mu.RLock()
	channel, exists := cs.channels[channelName]
	cs.mu.RUnlock()

	if !exists {
		return fmt.Errorf("channel %s does not exist ", channelName)
	}

	if !channel.IsAdmin(username) {
		return fmt.Errorf("Only admins can delete channels")
	}

	for username := range channel.GetMembers() {
		if err := channel.RemoveMember(username); err != nil {
			return fmt.Errorf("error removing user: %s, from channel: %w", username, err)
		}
	}

	if err := database.DeleteChannel(channelName); err != nil {
		return fmt.Errorf("error deleting channel: %w", err)
	}

	if err := cs.redisClient.UnSubscribe(channelName); err != nil {
		return fmt.Errorf("error unsubscribing to Redis channel %s: %v", channelName, err)
	}

	delete(cs.channels, channelName)

	log.Printf("Deleted channel %s\n", channelName)
	return nil
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

	return nil
}
