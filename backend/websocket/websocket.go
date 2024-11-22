package websocket

// WebSocket message handling logic

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"rtc-nb/backend/api/responses"
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
			Subprotocols: []string{"Authentication"},
		},
	}
}

func (wsh *WebSocketHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {

	if _, ok := w.(http.Hijacker); !ok {
		responses.SendError(w, "WebSocket not supported", http.StatusInternalServerError)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		fmt.Println("ERROR: No claims found in context")
		return
	}

	conn, err := wsh.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Error during WebSocket connection upgrade: %v", err)
		responses.SendError(w, fmt.Sprintf("Error during WebSocket connection upgrade: %v", err), http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	log.Printf("New WebSocket connection established: %s\n", r.URL.Path)

	wsh.connectionManager.AddConnection(claims.Username, conn)

	for {
		// Read messages from WebSocket connection
		err := wsh.handleMessages(conn, claims.Username)
		if err != nil {
			log.Println("Error handling WebSocket message:", err)
			break
		}
	}

}

func (wsh *WebSocketHandler) handleMessages(conn *websocket.Conn, username string) error {
	_, messageBytes, err := conn.ReadMessage()
	if err != nil {
		//log.Println("Error reading WebSocket message:", err)
		wsh.connectionManager.RemoveConnection(username)
		return fmt.Errorf("error reading WebSocket message: %v", err)
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
		return fmt.Errorf("invalid message format: %v", err)
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
		return fmt.Errorf("unknown message type received: %v", msgPayload.Type)
	}

	wsh.chatServer.HandleWebsocketMessage(message)
	return nil
}
