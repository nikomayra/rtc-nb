package messaging

import (
	"encoding/json"
	"fmt"
	"log"

	"rtc-nb/backend/internal/connections"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/internal/services/chat"
	"rtc-nb/backend/internal/services/sketch"
)

type Processor struct {
	connManager  connections.Manager
	chatService  *chat.Service
	sketchBuffer *SketchBuffer
	chatBuffer   *ChatBuffer
}

func NewProcessor(connManager connections.Manager, chatService *chat.Service, sketchService *sketch.Service) *Processor {
	return &Processor{
		connManager:  connManager,
		chatService:  chatService,
		sketchBuffer: NewSketchBuffer(sketchService),
		chatBuffer:   NewChatBuffer(chatService),
	}
}

func (p *Processor) ProcessMessage(msg *models.Message) error {
	if msg == nil {
		log.Printf("Skipping nil message")
		return nil
	}

	// Log basic message info for routing
	// log.Printf("Processing message: Type=%d, Channel=%s, SketchCmdType=%v",
	// 	msg.Type, msg.ChannelName,
	// 	func() models.SketchCommandType { // Avoid nil pointer if SketchCmd is nil
	// 		if msg.Content.SketchCmd != nil {
	// 			return msg.Content.SketchCmd.CommandType
	// 		}
	// 		return ""
	// 	}()) // Execute the function

	outgoingMsgBytes, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return err
	}

	// --- Route message to appropriate connections ---
	switch msg.Type {
	case models.MessageTypeChannelUpdate, models.MessageTypeSystemUserStatus:
		// System-wide messages
		log.Printf("Broadcasting system message type %d to all system connections", msg.Type)
		p.connManager.NotifyAll(outgoingMsgBytes)
	default:
		// Channel-specific messages
		if msg.ChannelName == "" {
			log.Printf("Skipping channel message with empty channel name (Type: %d)", msg.Type)
			return nil
		}
		if msg.Type != models.MessageTypeSketch {
			log.Printf("Broadcasting message type %d to channel %s", msg.Type, msg.ChannelName)
		}
		p.connManager.NotifyChannel(msg.ChannelName, outgoingMsgBytes)
	}

	// --- Buffer messages that need persistence ---
	switch msg.Type {
	case models.MessageTypeText, models.MessageTypeImage:
		// Persist regular chat messages
		p.chatBuffer.Add(msg)

	case models.MessageTypeSketch:
		// --- START ADDED DIAGNOSTIC LOGGING ---
		log.Printf("DEBUG: Processor received MessageTypeSketch. MsgID: %s, Channel: %s, User: %s", msg.ID, msg.ChannelName, msg.Username)
		if msg.Content.SketchCmd == nil {
			log.Printf("DEBUG: SketchCmd is nil for MsgID: %s. Skipping persistence.", msg.ID)
			break // Exit silently as before, but log why
		}
		// Log the relevant fields before the check
		cmd := msg.Content.SketchCmd // Assign cmd here
		isPartialValue := "nil"
		if cmd.IsPartial != nil {
			isPartialValue = fmt.Sprintf("%t", *cmd.IsPartial)
		}
		log.Printf("DEBUG: Checking SketchCmd for persistence: MsgID: %s, SketchID: %s, CommandType: %s, IsPartial: %s",
			msg.ID, cmd.SketchID, cmd.CommandType, isPartialValue)
		// --- END ADDED DIAGNOSTIC LOGGING ---

		// Original check for COMPLETE update persistence
		if cmd.CommandType == models.SketchCommandTypeUpdate && cmd.IsPartial != nil && !*cmd.IsPartial {
			log.Printf("Adding COMPLETE sketch update to buffer for sketch %s", cmd.SketchID) // This is the log we are sometimes missing
			p.sketchBuffer.Add(msg)
		} else {
			// --- ADDED LOGGING for non-persistence ---
			log.Printf("DEBUG: SketchCmd did NOT meet criteria for COMPLETE update persistence. MsgID: %s", msg.ID)
			// --- END ADDED LOGGING ---
		}
	}

	return nil
}
