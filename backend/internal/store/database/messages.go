package models

import (
	"encoding/json"
	"rtc-nb/backend/internal/domain"
	"time"
)

type MessageDB struct {
	ID          string          `db:"id"`
	ChannelName string          `db:"channel_name"`
	Username    string          `db:"username"`
	Type        int             `db:"message_type"`
	Content     json.RawMessage `db:"content"`
	Timestamp   time.Time       `db:"timestamp"`
}

func (m *MessageDB) ToEntity() (*domain.Message, error) {
	var content domain.MessageContent

	switch domain.MessageType(m.Type) {
	case domain.MessageTypeText:
		var textContent domain.TextContent
		if err := json.Unmarshal(m.Content, &textContent); err != nil {
			return nil, err
		}
		content = &textContent
	case domain.MessageTypeImage:
		var imageContent domain.ImageContent
		if err := json.Unmarshal(m.Content, &imageContent); err != nil {
			return nil, err
		}
		content = &imageContent
	}

	return &domain.Message{
		ID:          m.ID,
		ChannelName: m.ChannelName,
		Username:    m.Username,
		Type:        domain.MessageType(m.Type),
		Content:     content,
		Timestamp:   m.Timestamp,
	}, nil
}
