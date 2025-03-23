package websocket

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"rtc-nb/backend/internal/auth"
	"rtc-nb/backend/internal/connections"
	"rtc-nb/backend/internal/messaging"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/pkg/api/responses"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

type Handler struct {
	upgrader     websocket.Upgrader
	connMgr      connections.Manager
	msgProcessor *messaging.Processor
}

func NewHandler(connMgr connections.Manager, msgProcessor *messaging.Processor) *Handler {
	return &Handler{
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true // TODO: implement proper origin checking
			},
			Subprotocols: []string{"Authentication"},
		},
		connMgr:      connMgr,
		msgProcessor: msgProcessor,
	}
}

func (h *Handler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	if _, ok := w.(http.Hijacker); !ok {
		responses.SendError(w, "WebSocket not supported", http.StatusInternalServerError)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		log.Printf("Unauthorized")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	channelName := vars["channelName"]
	if channelName == "" {
		log.Printf("Channel name required")
		http.Error(w, "Channel name required", http.StatusBadRequest)
		return
	}

	log.Printf("Channel websocket connection for user %s to channel %s", claims.Username, channelName)

	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Error during WebSocket connection upgrade: %v", err)
		responses.SendError(w, fmt.Sprintf("Error during WebSocket connection upgrade: %v", err), http.StatusInternalServerError)
		return
	}

	// Register user connection
	h.connMgr.AddConnection(claims.Username, conn)
	h.connMgr.AddClientToChannel(channelName, conn)
	log.Printf("Added user %s to channel %s", claims.Username, channelName)

	// Cleanup on disconnect
	defer func() {
		h.connMgr.RemoveConnection(claims.Username)
		h.connMgr.RemoveClientFromChannel(channelName, conn)
		log.Printf("Removed user %s from channel %s", claims.Username, channelName)
		conn.Close()
	}()

	// Handle messages
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

		err = h.msgProcessor.ProcessMessage(outgoingMsg)
		if err != nil {
			log.Printf("Error processing message: %v", err)
		}
	}
}

// HandleSystemWebSocket handles WebSocket connections for system-wide messages
func (h *Handler) HandleSystemWebSocket(w http.ResponseWriter, r *http.Request) {
	// Verify authentication
	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		log.Printf("Unauthorized system WebSocket connection attempt")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	username := claims.Username
	log.Printf("Handling system WebSocket connection for user: %s", username)

	// Upgrade HTTP connection to WebSocket
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Error upgrading system WebSocket for user %s: %v", username, err)
		return
	}

	// Register the system connection (separate from channel connections)
	h.connMgr.AddSystemConnection(username, conn)
	defer func() {
		log.Printf("Closing system WebSocket connection for user: %s", username)
		conn.Close()
		h.connMgr.RemoveSystemConnection(username)
	}()

	// Process incoming system messages
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("System WebSocket error for user %s: %v", username, err)
			} else {
				log.Printf("System WebSocket closed for user %s", username)
			}
			break
		}

		// Parse the incoming system message
		var incomingMsg models.IncomingMessage
		if err := json.Unmarshal(message, &incomingMsg); err != nil {
			log.Printf("Error unmarshaling system message: %v", err)
			continue
		}

		// Verify this is actually a system message (ChannelUpdate only)
		if incomingMsg.Type != models.MessageTypeChannelUpdate {
			log.Printf("Received non-system message type %d on system WebSocket", incomingMsg.Type)
			continue
		}

		// Create a new message from the incoming data
		outgoingMsg, err := models.NewMessage(&incomingMsg, username)
		if err != nil {
			log.Printf("Error creating system message: %v", err)
			continue
		}

		// Process the system message
		err = h.msgProcessor.ProcessMessage(outgoingMsg)
		if err != nil {
			log.Printf("Error processing system message: %v", err)
		}
	}
}
