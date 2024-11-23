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

type TextMessage struct {
	Text string `json:"text"`
}

func (t *TextMessage) GetType() MessageType {
	return MessageTypeText
}

func (t *TextMessage) Validate() error {
	if t.Text == "" {
		return errors.New("message text cannot be empty")
	}
	return nil
}

type ImageMessage struct {
	URL string `json:"url"`
}

func (i *ImageMessage) GetType() MessageType {
	return MessageTypeImage
}

func (i *ImageMessage) Validate() error {
	if i.URL == "" {
		return errors.New("image URL cannot be empty")
	}
	return nil
}

func NewTextMessage(channelName, username, text string) (*Message, error) {
	content := &TextMessage{Text: text}
	if err := content.Validate(); err != nil {
		return nil, err
	}

	if channelName == "" {
		return nil, errors.New("channel name cannot be empty")
	}
	if username == "" {
		return nil, errors.New("username cannot be empty")
	}

	return &Message{
		ID:          uuid.NewString(),
		ChannelName: channelName,
		Username:    username,
		Type:        MessageTypeText,
		Content:     content,
		Timestamp:   time.Now().UTC(),
	}, nil
}

func NewImageMessage(channelName, username, imageURL string) (*Message, error) {
	content := &ImageMessage{URL: imageURL}
	if err := content.Validate(); err != nil {
		return nil, err
	}

	if channelName == "" {
		return nil, errors.New("channel name cannot be empty")
	}
	if username == "" {
		return nil, errors.New("username cannot be empty")
	}

	return &Message{
		ID:          uuid.NewString(),
		ChannelName: channelName,
		Username:    username,
		Type:        MessageTypeImage,
		Content:     content,
		Timestamp:   time.Now().UTC(),
	}, nil
}
