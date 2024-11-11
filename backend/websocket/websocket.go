package websocket

// WebSocket message handling logic

import (
	//"encoding/json"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"rtc-nb/backend/chat"
	"rtc-nb/backend/internal/auth"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/redis"
	"rtc-nb/backend/websocket/connection"

	"github.com/gorilla/websocket"
)

type WebSocketHandler struct {
	redisClient       *redis.RedisClient // Redis client for pub/sub
	chatServer        *chat.ChatServer
	connectionManager *connection.ConnectionManager
	upgrader          websocket.Upgrader // Upgrader for handling WebSocket connections
}

func NewWebSocketHandler(redisClient *redis.RedisClient, chatServer *chat.ChatServer, connectionManager *connection.ConnectionManager) *WebSocketHandler {
	return &WebSocketHandler{
		redisClient:       redisClient,
		chatServer:        chatServer,
		connectionManager: connectionManager,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow connections from any origin
			},
		},
	}
}

func authorizeWebSocketRequest(w http.ResponseWriter, r *http.Request) (string, error) {
	token := r.Header.Get("Authorization")
	if token == "" {
		http.Error(w, "Unauthorized: No authorization token provided", http.StatusUnauthorized)
		return "", fmt.Errorf("no authorization token provided")
	}
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	claims, err := auth.VerifyToken(token)
	if err != nil {
		http.Error(w, "Unauthorized: Invalid or expired token", http.StatusUnauthorized)
		return "", fmt.Errorf("no authorization token provided")
	}

	return claims.Username, nil
}

func (wsh *WebSocketHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {

	username, err := authorizeWebSocketRequest(w, r)
	if err != nil {
		log.Println("Error authorizing websocket request:", err)
		return
	}

	conn, err := wsh.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error during WebSocket connection upgrade:", err)
		return
	}
	defer conn.Close()

	log.Printf("New WebSocket connection established: %s\n", r.URL.Path)

	wsh.connectionManager.AddConnection(username, conn)

	for {
		// Read messages from WebSocket connection
		wsh.handleMessages(conn, username)

	}

}

func (wsh *WebSocketHandler) handleMessages(conn *websocket.Conn, username string) {
	_, messageBytes, err := conn.ReadMessage()
	if err != nil {
		log.Println("Error reading WebSocket message:", err)
		wsh.connectionManager.RemoveConnection(username)
		return
	}

	var msgPayload struct {
		ChannelName string `json:"channelName"`
		Type        int    `json:"type"`
		Text        string `json:"text,omitempty"`
		//ImageURL    string `json:"imageURL,omitempty"`
		// TODO: add fields for video, audio as needed
	}
	if err := json.Unmarshal(messageBytes, &msgPayload); err != nil {
		log.Println("Invalid message format:", err)
		return
	}

	var message *models.Message
	switch models.MessageType(msgPayload.Type) {
	case models.MessageTypeText:
		message = models.NewTextMessage(msgPayload.ChannelName, username, msgPayload.Text)
	// case models.MessageTypeImage:
	//     message = models.NewImageMessage(msgPayload.ChannelName, username, msgPayload.ImageURL)
	// Add cases for other message types
	default:
		log.Println("Unknown message type received:", msgPayload.Type)
		return
	}

	wsh.chatServer.HandleWebsocketMessage(message)
}
