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
    connManager connections.Manager
    chatService *chat.Service
    sketchService *sketch.Service
	sketchBuffer *SketchBuffer
	chatBuffer *ChatBuffer
}

func NewProcessor(connManager connections.Manager, chatService *chat.Service, sketchService *sketch.Service) *Processor {
	return &Processor{
		connManager: connManager,
		chatService: chatService,
		sketchService: sketchService,
		sketchBuffer: NewSketchBuffer(sketchService),
		chatBuffer: NewChatBuffer(chatService),
	}
}

func (p *Processor) ProcessMessage(msg *models.Message) error {
	outgoingMsgBytes, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return err
	}
    // Handle real-time broadcast
    p.connManager.NotifyChannel(msg.ChannelName, outgoingMsgBytes)
    
    //Buffer for persistence
    if msg.RequiresPersistence() {
        if msg.Type == models.MessageTypeSketchUpdate {
            p.sketchBuffer.Add(msg)
        } else {
            p.chatBuffer.Add(msg)
        }
    }
	return nil
}