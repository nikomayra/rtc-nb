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
	MessageTypeVideo
	MessageTypeAudio
	MessageTypeDocument
	MessageTypeSketch
)

type MessageContent struct {
	Text         string   `json:"text,omitempty"`
	FileURL      string   `json:"fileurl,omitempty"`
	ThumbnailURL string   `json:"thumbnailurl,omitempty"`
	SketchCoords [][]bool `json:"sketchcoords,omitempty"`
	SketchID     string   `json:"sketchid,omitempty"`
}

type IncomingMessage struct {
	ChannelName string         `json:"channelname"`
	Type        MessageType    `json:"type"`
	Content     MessageContent `json:"content"`
}

type Message struct {
	ID          string         `json:"id"`
	ChannelName string         `json:"channelName"`
	Username    string         `json:"username"`
	Type        MessageType    `json:"type"`
	Content     MessageContent `json:"content"`
	Timestamp   time.Time      `json:"timestamp"`
}

func (m *IncomingMessage) Validate() error {
	if m.ChannelName == "" {
		return errors.New("channelname required")
	}

	if m.Type != MessageTypeText && m.Type != MessageTypeImage {
		return errors.New("invalid message type")
	}

	// Validate content based on type
	switch m.Type {
	case MessageTypeText:
		if m.Content.Text == "" {
			return errors.New("text content required for text message")
		}
	case MessageTypeImage, MessageTypeVideo:
		if m.Content.FileURL == "" || m.Content.ThumbnailURL == "" {
			return errors.New("file and thumbnail URLs required for file message")
		}
	case MessageTypeAudio, MessageTypeDocument:
		if m.Content.FileURL == "" {
			return errors.New("file URL required for audio or document message")
		}
	case MessageTypeSketch:
		if m.Content.SketchCoords == nil {
			return errors.New("sketch coordinates required for sketch message")
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
	// TODO: TBD, no persistence for private messages between users.
	return true
}
