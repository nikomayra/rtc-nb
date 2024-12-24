package websocket

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"rtc-nb/backend/internal/auth"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/internal/store/database"
	"rtc-nb/backend/internal/store/redis"
	"rtc-nb/backend/pkg/api/responses"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

type WebSocketHandler struct {
	upgrader      websocket.Upgrader
	hub           *Hub
	messageBuffer *MessageBuffer
	db            *database.Store
}

func NewWebSocketHandler(hub *Hub, db *database.Store, cache *redis.Cache) *WebSocketHandler {
	return &WebSocketHandler{
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true // TODO: implement proper origin checking
			},
			Subprotocols: []string{"Authentication"},
		},
		hub:           hub,
		messageBuffer: NewMessageBuffer(db),
		db:            db,
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

	vars := mux.Vars(r)
	channelName := vars["channelName"]
	if channelName == "" {
		http.Error(w, "Channel name required", http.StatusBadRequest)
		return
	}

	// channel membership validation
	userChannel, err := wsh.db.GetUserChannel(r.Context(), claims.Username)
	if err != nil {
		http.Error(w, "Error validating channel membership", http.StatusInternalServerError)
		return
	}

	if userChannel != channelName {
		http.Error(w, "Not a member of this channel", http.StatusForbidden)
		return
	}

	conn, err := wsh.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Error during WebSocket connection upgrade: %v", err)
		responses.SendError(w, fmt.Sprintf("Error during WebSocket connection upgrade: %v", err), http.StatusInternalServerError)
		return
	}

	// Register connection for both user and channel
	wsh.hub.AddConnection(claims.Username, conn)
	wsh.hub.AddClientToChannel(channelName, conn)

	// Cleanup on disconnect
	defer func() {
		wsh.hub.RemoveConnection(claims.Username)
		wsh.hub.RemoveClientFromChannel(channelName, conn)
		conn.Close()
	}()

	// TODO: Proper error handling
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Error reading message: %v", err)
			}
			break
		}

		var incomingMsg models.IncomingMessage
		if err := json.Unmarshal(message, &incomingMsg); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}

		outgoingMsg, err := models.NewMessage(&incomingMsg, claims.Username)
		if err != nil {
			log.Printf("Error creating message: %v", err)
			continue
		}

		outgoingMsgBytes, err := json.Marshal(outgoingMsg)
		if err != nil {
			log.Printf("Error marshaling message: %v", err)
			continue
		}

		// Add to message buffer
		wsh.messageBuffer.Add(outgoingMsg)

		// Broadcast message to channel
		wsh.hub.NotifyChannel(channelName, outgoingMsgBytes)
	}
}
