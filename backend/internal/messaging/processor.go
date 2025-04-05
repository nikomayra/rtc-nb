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
	connManager   connections.Manager
	chatService   *chat.Service
	sketchService *sketch.Service
	sketchBuffer  *SketchBuffer
	chatBuffer    *ChatBuffer
}

func NewProcessor(connManager connections.Manager, chatService *chat.Service, sketchService *sketch.Service) *Processor {
	return &Processor{
		connManager:   connManager,
		chatService:   chatService,
		sketchService: sketchService,
		sketchBuffer:  NewSketchBuffer(sketchService),
		chatBuffer:    NewChatBuffer(chatService),
	}
}

func (p *Processor) ProcessMessage(msg *models.Message) error {
	if msg == nil {
		log.Printf("Skipping nil message")
		return nil
	}

	// Log detailed message info for debugging
	log.Printf("Processing message: ID=%s, Type=%d, Username=%s, Channel=%s",
		msg.ID, msg.Type, msg.Username, msg.ChannelName)

	outgoingMsgBytes, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return err
	}

	// Step 1: Route message to appropriate connections
	// -----------------------------------------------
	switch msg.Type {
	case models.MessageTypeChannelUpdate:
		// Only channel updates are system-wide messages
		log.Printf("Broadcasting system message type %d to all system connections", msg.Type)
		p.connManager.NotifyAll(outgoingMsgBytes)
	case models.MessageTypeSystemUserStatus:
		log.Printf("Broadcasting system user status message type %d to all system connections", msg.Type)
		p.connManager.NotifyAll(outgoingMsgBytes)

	default:
		// All other messages are channel-specific
		if msg.ChannelName == "" {
			log.Printf("Skipping message with empty channel name")
			return nil
		}

		log.Printf("Broadcasting message type %d to channel %s", msg.Type, msg.ChannelName)
		p.connManager.NotifyChannel(msg.ChannelName, outgoingMsgBytes)
	}

	// Step 2: Buffer messages that need persistence
	// --------------------------------------------
	// Only certain message types should be buffered for persistence
	switch msg.Type {
	case models.MessageTypeText, models.MessageTypeImage:
		// Regular chat messages should be persisted
		log.Printf("Adding message to chat buffer for channel %s", msg.ChannelName)
		p.chatBuffer.Add(msg)

	case models.MessageTypeSketch:
		// Only buffer sketch update commands
		if msg.Content.SketchCmd != nil && msg.Content.SketchCmd.CommandType == models.SketchCommandTypeUpdate {
			log.Printf("Adding sketch update to buffer for channel %s", msg.ChannelName)
			p.sketchBuffer.Add(msg)
		}

	case models.MessageTypeChannelUpdate, models.MessageTypeMemberUpdate, models.MessageTypeUserStatus:
		// System messages should not be persisted - they only update UI state
		log.Printf("Skipping persistence for system message type %d", msg.Type)
	}

	return nil
}
