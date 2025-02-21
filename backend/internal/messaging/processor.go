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
	outgoingMsgBytes, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return err
	}

	// For channel and member updates, broadcast to all connected clients
	if msg.Type == models.MessageTypeChannelUpdate || msg.Type == models.MessageTypeMemberUpdate {
		p.connManager.NotifyAll(outgoingMsgBytes)
	} else {
		// Handle real-time broadcast to specific channel
		p.connManager.NotifyChannel(msg.ChannelName, outgoingMsgBytes)
	}

	// Buffer for persistence - only buffer Update commands
	if msg.Type == models.MessageTypeSketch {
		if msg.Content.SketchCmd != nil && msg.Content.SketchCmd.CommandType == models.SketchCommandTypeUpdate {
			p.sketchBuffer.Add(msg)
		}
	} else {
		p.chatBuffer.Add(msg)
	}

	return nil
}
