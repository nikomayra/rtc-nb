package websocket

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"rtc-nb/backend/internal/auth"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/pkg/api/responses"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

type WebSocketHandler struct {
	upgrader websocket.Upgrader
	hub      *Hub
	//mu       sync.RWMutex
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

	vars := mux.Vars(r)
	channelName := vars["channelName"]
	log.Printf("HandleWebSocket channelName: %s", channelName)
	if channelName == "" {
		http.Error(w, "Channel name required", http.StatusBadRequest)
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

	// Handle incoming messages
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

		// Broadcast message to channel
		wsh.hub.NotifyChannel(channelName, outgoingMsgBytes)
	}
}
