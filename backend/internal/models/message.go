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

type TextContent struct {
	Text string `json:"text"`
}

type ImageContent struct {
	URL string `json:"url"`
}

type IncomingMessage struct {
	ChannelName string      `json:"channelname"`
	Type        MessageType `json:"type"`
	Content     interface{} `json:"content"`
}

type Message struct {
	ID          string      `json:"id"`
	ChannelName string      `json:"channelName"`
	Username    string      `json:"username"`
	Type        MessageType `json:"type"`
	Content     interface{} `json:"content"`
	Timestamp   time.Time   `json:"timestamp"`
}

func (m *IncomingMessage) Validate() error {
	if m.ChannelName == "" {
		return errors.New("channelname required")
	}

	switch m.Type {
	case MessageTypeText:
		content, ok := m.Content.(map[string]interface{})
		if !ok || content["text"] == "" {
			return errors.New("invalid text content")
		}
	case MessageTypeImage:
		content, ok := m.Content.(map[string]interface{})
		if !ok || content["url"] == "" {
			return errors.New("invalid image content")
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
