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
	upgrader      websocket.Upgrader
	connMgr       connections.Manager
	msgProcessor  *messaging.Processor
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
		connMgr:       connMgr,
		msgProcessor:  msgProcessor,
	}
}

func (wsh *Handler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {

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

	// channel membership validation
	// userChannel, err := wsh.connMgr.GetUserChannel(claims.Username)
	// if err != nil {
	// 	log.Printf("Error validating channel membership: %v", err)
	// 	http.Error(w, "Error validating channel membership", http.StatusInternalServerError)
	// 	return
	// }

	// if userChannel != channelName {
	// 	log.Printf("Not a member of this channel")
	// 	http.Error(w, "Not a member of this channel", http.StatusForbidden)
	// 	return
	// }

	conn, err := wsh.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Error during WebSocket connection upgrade: %v", err)
		responses.SendError(w, fmt.Sprintf("Error during WebSocket connection upgrade: %v", err), http.StatusInternalServerError)
		return
	}

	// Register connection for both user and channel
	wsh.connMgr.AddConnection(claims.Username, conn)
	wsh.connMgr.AddClientToChannel(channelName, conn)

	// Cleanup on disconnect
	defer func() {
		wsh.connMgr.RemoveConnection(claims.Username)
		wsh.connMgr.RemoveClientFromChannel(channelName, conn)
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

		err = wsh.msgProcessor.ProcessMessage(outgoingMsg)
		if err != nil {
			log.Printf("Error processing message: %v", err)
		}
	}
}
