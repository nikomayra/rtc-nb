package chat

import (
	"log"
	"rtc-nb/backend/internal/database"
	"rtc-nb/backend/internal/models"
	"time"
)

func (cs *ChatServer) persistWorker() {
	messageBatch := make([]*models.Message, 0, 100)
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case op := <-cs.persistQueue:
			switch op.opType {
			case "message":
				if msg, ok := op.data.(*models.Message); ok {
					messageBatch = append(messageBatch, msg)
					if len(messageBatch) >= 100 {
						cs.persistMessages(messageBatch)
						messageBatch = messageBatch[:0]
					}
				}
			case "channel_create", "channel_delete", "channel_join", "channel_leave":
				cs.handleChannelOperation(op)
			}
		case <-ticker.C:
			if len(messageBatch) > 0 {
				cs.persistMessages(messageBatch)
				messageBatch = messageBatch[:0]
			}
		}
	}
}

func (cs *ChatServer) persistMessages(messages []*models.Message) {
	for _, msg := range messages {
		if err := database.SaveMessage(msg); err != nil {
			log.Printf("Failed to save message: %v", err)
		}
	}
}

func (cs *ChatServer) handleChannelOperation(op persistOperation) {
	switch op.opType {
	case "channel_create":
		if channel, ok := op.data.(*models.Channel); ok {
			if err := database.CreateChannel(channel, channel.CreatedBy); err != nil {
				log.Printf("Failed to create channel: %v", err)
			}
		}
	case "channel_delete":
		if channel, ok := op.data.(*models.Channel); ok {
			if err := database.DeleteChannel(channel.Name); err != nil {
				log.Printf("Failed to delete channel: %v", err)
			}
		}
	case "channel_join":
		if channel, ok := op.data.(*models.Channel); ok {
			if err := database.AddUserToChannel(channel.Name, channel.CreatedBy, false); err != nil {
				log.Printf("Failed to join channel: %v", err)
			}
		}
	case "channel_leave":
		if channel, ok := op.data.(*models.Channel); ok {
			if err := database.RemoveUserFromChannel(channel.Name, channel.CreatedBy); err != nil {
				log.Printf("Failed to leave channel: %v", err)
			}
		}
	}
}
