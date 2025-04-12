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

	"time"

	"github.com/google/uuid"
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

	// log.Printf("Channel websocket connection for user %s to channel %s", claims.Username, channelName)

	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Error during WebSocket connection upgrade: %v", err)
		responses.SendError(w, fmt.Sprintf("Error during WebSocket connection upgrade: %v", err), http.StatusInternalServerError)
		return
	}

	// Register user connection
	err = h.connMgr.AddConnection(claims.Username, conn)
	if err != nil {
		log.Printf("Duplicate WebSocket connection attempt for user %s in channel %s. Closing new connection. Error: %v", claims.Username, channelName, err)
		conn.Close()
		return
	}
	h.connMgr.AddClientToChannel(channelName, conn)
	// log.Printf("Added user %s to channel %s", claims.Username, channelName)
	h.broadcastUserStatus(channelName, claims.Username, "online")

	// Cleanup on disconnect
	defer func() {
		// log.Printf("Removed user %s from channel %s", claims.Username, channelName)
		h.connMgr.RemoveConnection(claims.Username)
		h.connMgr.RemoveClientFromChannel(channelName, conn)
		h.broadcastUserStatus(channelName, claims.Username, "offline")
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

func (h *Handler) broadcastUserStatus(channelName, username, status string) {
	// Create user status message
	msg := &models.Message{
		ID:          uuid.NewString(),
		ChannelName: channelName,
		Username:    username,
		Type:        models.MessageTypeUserStatus,
		Timestamp:   time.Now().UTC(),
		Content: models.MessageContent{
			UserStatus: &models.UserStatus{
				Action:   status,
				Username: username,
			},
		},
	}

	// Serialize the message
	msgBytes, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling user status message: %v", err)
		return
	}

	// Broadcast to the channel
	h.connMgr.NotifyChannel(channelName, msgBytes)
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
	// log.Printf("Handling system WebSocket connection for user: %s", username)

	// Upgrade HTTP connection to WebSocket
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Error upgrading system WebSocket for user %s: %v", username, err)
		return
	}

	// Register the system connection (separate from channel connections)
	h.connMgr.AddSystemConnection(username, conn)
	h.broadcastSystemUserCount()
	defer func() {
		// log.Printf("Closing system WebSocket connection for user: %s", username)
		h.connMgr.RemoveSystemConnection(username)
		h.broadcastSystemUserCount()
		conn.Close()
	}()

	// Process incoming system messages
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				// log.Printf("System WebSocket error for user %s: %v", username, err)
			} else {
				// log.Printf("System WebSocket closed for user %s", username)
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
			// log.Printf("Received non-system message type %d on system WebSocket", incomingMsg.Type)
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

func (h *Handler) broadcastSystemUserCount() {
	count := h.connMgr.GetCountOfAllOnlineUsers()

	// Create and broadcast the system user status message
	msg := &models.Message{
		ChannelName: "system",
		Username:    "system",
		ID:          uuid.NewString(),
		Type:        models.MessageTypeSystemUserStatus,
		Timestamp:   time.Now().UTC(),
		Content: models.MessageContent{
			SystemUserStatus: &models.SystemUserStatus{
				Count: count,
			},
		},
	}

	// Serialize the message
	msgBytes, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling system user count message: %v", err)
		return
	}

	// Broadcast to all system connections
	h.connMgr.NotifyAll(msgBytes)
}
