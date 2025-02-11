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
	MessageTypeSketch
)

type SketchCommandType string

const (
	SketchCommandTypeUpdate SketchCommandType = "UPDATE"
	SketchCommandTypeClear  SketchCommandType = "CLEAR"
	SketchCommandTypeDelete SketchCommandType = "DELETE"
	SketchCommandTypeNew    SketchCommandType = "NEW"
)

type SketchCommand struct {
	CommandType SketchCommandType `json:"command_type"`
	SketchID    string            `json:"sketch_id"`
	Region      *Region           `json:"region,omitempty"`
	SketchData  *Sketch           `json:"sketch_data,omitempty"`
}

type MessageContent struct {
	Text         *string        `json:"text,omitempty"`
	FileURL      *string        `json:"file_url,omitempty"`
	ThumbnailURL *string        `json:"thumbnail_url,omitempty"`
	SketchCmd    *SketchCommand `json:"sketch_cmd,omitempty"`
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

	switch m.Type {
	case MessageTypeText:
		if m.Content.Text == nil {
			return errors.New("text content required for text message")
		}
	case MessageTypeImage:
		if m.Content.FileURL == nil || m.Content.ThumbnailURL == nil {
			return errors.New("file and thumbnail URLs required for file message")
		}
	case MessageTypeSketch:
		if m.Content.SketchCmd == nil {
			return errors.New("sketch command required for sketch message")
		}
		switch m.Content.SketchCmd.CommandType {
		case SketchCommandTypeUpdate:
			if m.Content.SketchCmd.SketchID == "" || m.Content.SketchCmd.Region == nil {
				return errors.New("sketch ID and region required for sketch update")
			}
		case SketchCommandTypeClear, SketchCommandTypeDelete:
			if m.Content.SketchCmd.SketchID == "" {
				return errors.New("sketch ID required for sketch command")
			}
		case SketchCommandTypeNew:
			if m.Content.SketchCmd.SketchID == "" || m.Content.SketchCmd.SketchData == nil {
				return errors.New("sketch ID and sketch data required for new sketch")
			}
		default:
			return errors.New("invalid sketch command type")
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

// func (m *Message) RequiresPersistence() bool {
// 	switch m.Type {
// 	case MessageTypeSketch:
// 		return false
// 	default:
// 		return true
// 	}
// }
