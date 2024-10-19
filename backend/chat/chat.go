package chat

// WebSocket message handling logic

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

// ChatServer handles WebSocket connections
type ChatServer struct {
	redisClient *RedisClient // Redis client for pub/sub
	upgrader     websocket.Upgrader // Upgrader for handling WebSocket connections
}

// NewChatServer initializes a new ChatServer
func NewChatServer(redisClient *RedisClient) *ChatServer {
	return &ChatServer{
		redisClient: redisClient,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow connections from any origin
			},
		},
	}
}

// HandleWebSocket handles incoming WebSocket connections
func (cs *ChatServer) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := cs.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error during connection upgrade:", err)
		return
	}
	defer conn.Close()

	// Subscribe to Redis channel for messages
	channel := "chat"
	sub, err := cs.redisClient.Subscribe(channel)
	if err != nil {
		log.Println("Error subscribing to channel:", err)
		return
	}

	go func() {
		for msg := range sub {
			// Send incoming messages to the WebSocket connection
			if err := conn.WriteMessage(websocket.TextMessage, []byte(msg.Payload)); err != nil {
				log.Println("Error writing message:", err)
				return
			}
		}
	}()

	for {
		// Read messages from WebSocket connection
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Println("Error reading message:", err)
			break
		}

		// Publish the message to Redis
		if err := cs.redisClient.Publish(channel, string(message)); err != nil {
			log.Println("Error publishing message:", err)
		}
	}
}
