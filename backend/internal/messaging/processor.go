package messaging

import (
	"encoding/json"
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
	log.Printf("Processing message: Type=%d, Channel=%s, SketchCmdType=%v",
		msg.Type, msg.ChannelName,
		func() models.SketchCommandType { // Avoid nil pointer if SketchCmd is nil
			if msg.Content.SketchCmd != nil {
				return msg.Content.SketchCmd.CommandType
			}
			return ""
		}()) // Execute the function

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
		log.Printf("Broadcasting message type %d to channel %s", msg.Type, msg.ChannelName)
		p.connManager.NotifyChannel(msg.ChannelName, outgoingMsgBytes)
	}

	// --- Buffer messages that need persistence ---
	switch msg.Type {
	case models.MessageTypeText, models.MessageTypeImage:
		// Persist regular chat messages
		p.chatBuffer.Add(msg)

	case models.MessageTypeSketch:
		cmd := msg.Content.SketchCmd
		if cmd == nil {
			break
		}

		if cmd.CommandType == models.SketchCommandTypeUpdate && cmd.IsPartial != nil && !*cmd.IsPartial {
			// Persist only COMPLETE sketch updates
			log.Printf("Adding COMPLETE sketch update to buffer for sketch %s", cmd.SketchID)
			p.sketchBuffer.Add(msg)
		}
	}

	return nil
}
