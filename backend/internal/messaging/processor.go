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

	// For system-level messages (channel/member updates), always use system connections
	if msg.Type == models.MessageTypeChannelUpdate ||
		msg.Type == models.MessageTypeMemberUpdate ||
		msg.Type == models.MessageTypeUserStatus {
		log.Printf("Broadcasting system message type %d to all system connections", msg.Type)
		// This will only broadcast to system connections, not regular channel connections
		p.connManager.NotifyAll(outgoingMsgBytes)
	} else {
		// For channel-specific messages, ensure the channel exists
		if msg.ChannelName == "" {
			log.Printf("Skipping message with empty channel name")
			return nil
		}

		log.Printf("Broadcasting message type %d to channel %s", msg.Type, msg.ChannelName)

		// Broadcast to the specific channel
		p.connManager.NotifyChannel(msg.ChannelName, outgoingMsgBytes)
	}

	// Persist messages as needed
	switch msg.Type {
	case models.MessageTypeSketch:
		// Only buffer sketch update commands
		if msg.Content.SketchCmd != nil && msg.Content.SketchCmd.CommandType == models.SketchCommandTypeUpdate {
			log.Printf("Adding sketch update to buffer for channel %s", msg.ChannelName)
			p.sketchBuffer.Add(msg)
		}
	case models.MessageTypeText, models.MessageTypeImage:
		// Buffer text and image messages
		log.Printf("Adding message to chat buffer for channel %s", msg.ChannelName)
		p.chatBuffer.Add(msg)
	case models.MessageTypeChannelUpdate, models.MessageTypeMemberUpdate, models.MessageTypeUserStatus:
		// Do not buffer system messages
		log.Printf("Skipping buffer for system message type %d", msg.Type)
	}

	return nil
}
