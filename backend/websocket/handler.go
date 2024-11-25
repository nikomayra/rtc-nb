package websocketmanager

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"rtc-nb/backend/api/responses"
	"rtc-nb/backend/chat"
	"rtc-nb/backend/internal/auth"
	"rtc-nb/backend/internal/events"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/redismanager"
	"rtc-nb/backend/websocketmanager/connection"

	"github.com/gorilla/websocket"
)

type WebSocketHandler struct {
	redisClient       *redismanager.RedisClient // Redis client for pub/sub
	chatServer        *chat.ChatServer
	connectionManager *connection.ConnectionManager
	upgrader          websocket.Upgrader // Upgrader for handling WebSocket connections
}

func NewWebSocketHandler(redisClient *redismanager.RedisClient, chatServer *chat.ChatServer, connectionManager *connection.ConnectionManager) *WebSocketHandler {
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
		err := wsh.handleWebSocketMessages(conn, claims.Username)
		if err != nil {
			log.Println("Error handling WebSocket message:", err)
			break
		}
	}

}

func (wsh *WebSocketHandler) handleWebSocketMessages(conn *websocket.Conn, username string) error {
	_, messageBytes, err := conn.ReadMessage()
	if err != nil {
		wsh.connectionManager.RemoveConnection(username)
		return fmt.Errorf("error reading WebSocket message: %v", err)
	}
	event, err := events.ParseEvent(messageBytes)
	if err != nil {
		return fmt.Errorf("invalid event format: %v", err)
	}

	switch event.Type {
	case events.EventTypeChannel:
		return wsh.handleChannelEvent(event)
	case events.EventTypeMessage:
		return wsh.handleMessageEvent(event)
	default:
		return fmt.Errorf("unknown event type: %s", event.Type)
	}
}

func (wsh *WebSocketHandler) handleChannelEvent(event *events.Event) error {

	payload, err := event.ParseChannelPayload()
	if err != nil {
		return fmt.Errorf("invalid channel event payload: %v", err)
	}

	switch payload.Operation {
	case events.OperationChannelCreate:
		return wsh.chatServer.CreateChannel(
			payload.Channel,
			payload.User,
			payload.Data.Description,
			payload.Data.Password,
		)
	case events.OperationChannelDelete:
		return wsh.chatServer.DeleteChannel(
			payload.Channel,
			payload.User,
		)
	case events.OperationChannelJoin:
		return wsh.chatServer.JoinChannel(
			payload.User,
			payload.Channel,
			payload.Data.Password,
		)
	case events.OperationChannelLeave:
		return wsh.chatServer.LeaveChannel(
			payload.User,
			payload.Channel,
		)
	default:
		return fmt.Errorf("unknown channel operation: %s", payload.Operation)
	}
}

func (wsh *WebSocketHandler) handleMessageEvent(event *events.Event) error {

	payload, err := event.ParseMessagePayload()
	if err != nil {
		return fmt.Errorf("invalid message event payload: %v", err)
	}

	switch payload.Operation {
	case events.OperationMessageSend:
		var msgContent struct {
			Type     models.MessageType `json:"type"`
			Text     string             `json:"text,omitempty"`
			ImageURL string             `json:"imageUrl,omitempty"`
		}
		if err := json.Unmarshal(payload.Message, &msgContent); err != nil {
			return fmt.Errorf("invalid message content: %v", err)
		}

		var message *models.Message
		switch msgContent.Type {
		case models.MessageTypeText:
			message, err = models.NewTextMessage(payload.Channel, payload.User, msgContent.Text)
		case models.MessageTypeImage:
			message, err = models.NewImageMessage(payload.Channel, payload.User, msgContent.ImageURL)
		default:
			return fmt.Errorf("unsupported message type: %v", msgContent.Type)
		}

		if err != nil {
			return err
		}
		return wsh.chatServer.HandleWebsocketMessage(message)
	default:
		return fmt.Errorf("unknown message operation: %s", payload.Operation)
	}
}
