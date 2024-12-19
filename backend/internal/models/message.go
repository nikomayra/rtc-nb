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
)

type MessageContent struct {
	Text         string `json:"text,omitempty"`
	ImageURL     string `json:"imageurl,omitempty"`
	ThumbnailURL string `json:"thumbnailurl,omitempty"`
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
	case MessageTypeImage:
		if m.Content.ImageURL == "" || m.Content.ThumbnailURL == "" {
			return errors.New("image and thumbnail URLs required for image message")
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
