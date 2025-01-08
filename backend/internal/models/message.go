package models

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

type MessageType int

const (
	MessageTypeText MessageType = iota
	MessageTypeImage
	MessageTypeSketchUpdate
	MessageTypeClearSketch
)

type SketchUpdate struct {
	SketchID string `json:"sketch_id"`
	Region   Region `json:"region"`
}

type MessageContent struct {
	Text         *string       `json:"text,omitempty"`
	FileURL      *string       `json:"file_url,omitempty"`
	ThumbnailURL *string       `json:"thumbnail_url,omitempty"`
	SketchUpdate *SketchUpdate `json:"sketch_update,omitempty"`
	ClearSketch  *string       `json:"clear_sketch,omitempty"` // id of sketch to clear
}

type IncomingMessage struct {
	ChannelName string         `json:"channel_name"`
	Type        MessageType    `json:"type"`
	Content     MessageContent `json:"content"`
}

type Message struct {
	ID          string         `json:"id"`
	ChannelName string         `json:"channel_name"`
	Username    string         `json:"username"`
	Type        MessageType    `json:"type"`
	Content     MessageContent `json:"content"`
	Timestamp   time.Time      `json:"timestamp"`
}

func (m *IncomingMessage) Validate() error {
	if m.ChannelName == "" {
		return errors.New("channel name required")
	}

	// if m.Type != MessageTypeText && m.Type != MessageTypeImage {
	// 	return errors.New("invalid message type")
	// }

	// Validate content based on type
	switch m.Type {
	case MessageTypeText:
		if m.Content.Text == nil {
			return errors.New("text content required for text message")
		}
	case MessageTypeImage:
		if m.Content.FileURL == nil || m.Content.ThumbnailURL == nil {
			return errors.New("file and thumbnail URLs required for file message")
		}
	case MessageTypeSketchUpdate:
		if m.Content.SketchUpdate.SketchID == "" && len(m.Content.SketchUpdate.Region.Paths) == 0 {
			return errors.New("sketch ID and region paths required for sketch message")
		}
	case MessageTypeClearSketch:
		if m.Content.ClearSketch == nil {
			return errors.New("sketch ID required for clear sketch message")
		}
	default:
		return errors.New("invalid message type")
	}

	return nil
}

func NewMessage(incoming *IncomingMessage, username string) (*Message, error) {
	if err := incoming.Validate(); err != nil {
		return nil, err
	}

	return &Message{
		ID:          uuid.NewString(),
		ChannelName: incoming.ChannelName,
		Username:    username,
		Type:        incoming.Type,
		Content:     incoming.Content,
		Timestamp:   time.Now().UTC(),
	}, nil
}

func (m *Message) RequiresPersistence() bool {
	switch m.Type {
	case MessageTypeClearSketch:
		return false
	default:
		return true
	}
}
