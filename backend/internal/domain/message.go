package domain

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
)

type Message struct {
	ID          string         `json:"id"`
	ChannelName string         `json:"channelName"`
	Username    string         `json:"username"`
	Type        MessageType    `json:"type"`
	Content     MessageContent `json:"content"`
	Timestamp   time.Time      `json:"timestamp"`
}

type MessageContent interface {
	GetType() MessageType
	Validate() error
}

type TextContent struct {
	Text string `json:"text"`
}

func (t *TextContent) GetType() MessageType {
	return MessageTypeText
}

func (t *TextContent) Validate() error {
	if t.Text == "" {
		return errors.New("message text cannot be empty")
	}
	return nil
}

type ImageContent struct {
	URL string `json:"url"`
}

func (i *ImageContent) GetType() MessageType {
	return MessageTypeImage
}

func (i *ImageContent) Validate() error {
	if i.URL == "" {
		return errors.New("image URL cannot be empty")
	}
	return nil
}

// Factory method
func NewMessage(channelName, username string, content MessageContent) (*Message, error) {
	if err := content.Validate(); err != nil {
		return nil, err
	}

	return &Message{
		ID:          uuid.NewString(),
		ChannelName: channelName,
		Username:    username,
		Type:        content.GetType(),
		Content:     content,
		Timestamp:   time.Now().UTC(),
	}, nil
}
