package chat

import (
	"encoding/json"
	"fmt"
	"log"
	"rtc-nb/backend/helpers"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/redis"
	"rtc-nb/backend/websocket/connection"

	"github.com/gorilla/websocket"
)

// ChatServer handles WebSocket connections
type ChatServer struct {
	redisClient       *redis.RedisClient         // Redis client for pub/sub
	channels          map[string]*models.Channel // map of channel names as type channel
	connectionManager *connection.ConnectionManager
}

// NewChatServer initializes a new ChatServer
func NewChatServer(redisClient *redis.RedisClient, connectionManager *connection.ConnectionManager) *ChatServer {
	cs := &ChatServer{
		redisClient:       redisClient,
		channels:          make(map[string]*models.Channel),
		connectionManager: connectionManager,
	}

	return cs
}

func (cs *ChatServer) CreateChannel(name, username string, description, password *string) error {

	if _, exists := cs.channels[name]; exists {
		return fmt.Errorf("channel %s already exists ", name)
	}

	channel := models.NewChannel(name, username, description, password)
	cs.channels[channel.Name] = channel
	log.Printf("Created channel %s\n", channel.Name)

	return nil
}

func (cs *ChatServer) DeleteChannel(channelName, username string) error {
	channel, exists := cs.channels[channelName]
	if !exists {
		return fmt.Errorf("channel %s does not exist ", channelName)
	}
	if !helpers.StringInSlice(username, channel.Admins) {
		return fmt.Errorf("not an admin of this channel ")
	}
	delete(cs.channels, channelName)
	log.Printf("Deleted channel %s\n", channelName)
	return nil
}

func (cs *ChatServer) LeaveChannel(username, channelName string) {
	if err := cs.redisClient.UnSubscribe(channelName); err != nil {
		log.Printf("Error unsubscribing to Redis channel %s: %v", channelName, err)
		return
	}

	for i, chUsername := range cs.channels[channelName].Users {
		if chUsername == username {
			cs.channels[channelName].Users = append(cs.channels[channelName].Users[:i], cs.channels[channelName].Users[i+1:]...)
			log.Printf("Client, ID: %s left channel %s.\n", username, channelName)
			return
		}
	}

	if len(cs.channels[channelName].Users) == 0 {
		delete(cs.channels, channelName) // Optionally clean up empty channels
	}
}

func (cs *ChatServer) JoinChannel(username, channelName string, password *string) error {

	if cs.channels[channelName].Password != password {
		return fmt.Errorf("incorrect channel password")
	}

	subChannel, err := cs.redisClient.Subscribe(channelName)
	if err != nil {
		log.Printf("Error subscribing to Redis channel %s: %v", channelName, err)
		return nil
	}

	go func() {
		for msg := range subChannel {
			// Handle the incoming message from Redis
			cs.handleRedisMessage(msg.Payload)
		}
	}()

	cs.channels[channelName].Users = append(cs.channels[channelName].Users, username)
	log.Printf("Client, ID: %s joined channel %s.\n", username, channelName)

	return nil
}

func (cs *ChatServer) HandleWebsocketMessage(message *models.Message) {

	messageJSON, err := json.Marshal(message)
	if err != nil {
		log.Println("Error marshaling message:", err)
		return
	}

	channelName := message.ChannelName
	if err := cs.redisClient.Publish(channelName, string(messageJSON)); err != nil {
		log.Printf("Error publishing to channel %s: %v\n", channelName, err)
	}
}

func (cs *ChatServer) handleRedisMessage(messageJSON string) {

	var message models.Message
	if err := json.Unmarshal([]byte(messageJSON), &message); err != nil {
		log.Println("Error unmarshaling Redis message:", err)
		return
	}

	for _, username := range cs.channels[message.ChannelName].Users {
		if conn, ok := cs.connectionManager.GetConnection(username); ok {
			messageToSend, err := json.Marshal(message)
			if err != nil {
				log.Println("Error marshaling message for WebSocket:", err)
				continue
			}

			if err := conn.WriteMessage(websocket.TextMessage, messageToSend); err != nil {
				log.Printf("Error writing message to client %s: %v", username, err)
			}
		}
	}
}
