package websocket

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"

	"rtc-nb/backend/internal/auth"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/pkg/api/responses"

	"github.com/gorilla/websocket"
)

type WebSocketHandler struct {
	upgrader websocket.Upgrader
	hub      *Hub
	mu       sync.RWMutex
}

func NewWebSocketHandler(hub *Hub) *WebSocketHandler {
	return &WebSocketHandler{
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true // TODO: implement proper origin checking
			},
			Subprotocols: []string{"Authentication"},
		},
		hub: hub,
	}
}

func (wsh *WebSocketHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {

	if _, ok := w.(http.Hijacker); !ok {
		responses.SendError(w, "WebSocket not supported", http.StatusInternalServerError)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := wsh.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Error during WebSocket connection upgrade: %v", err)
		responses.SendError(w, fmt.Sprintf("Error during WebSocket connection upgrade: %v", err), http.StatusInternalServerError)
		return
	}

	// Register connection
	wsh.hub.AddConnection(claims.Username, conn)
	defer func() {
		wsh.hub.RemoveConnection(claims.Username)
		conn.Close()
	}()

	// Handle incoming messages
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Error reading message: %v", err)
			}
			break
		}

		var msg models.Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}

		// Validate message sender
		if msg.Username != claims.Username {
			log.Printf("Message username mismatch: %s != %s", msg.Username, claims.Username)
			continue
		}

		// Broadcast message to channel
		wsh.hub.NotifyChannel(msg.ChannelName, message)
	}
}
