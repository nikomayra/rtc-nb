package events

import (
	"rtc-nb/backend/internal/models"
	"time"
)

type EventType string

const (
	EventChannelCreate EventType = "CHANNEL_CREATE"
	EventChannelDelete EventType = "CHANNEL_DELETE"
	EventChannelJoin   EventType = "CHANNEL_JOIN"
	EventChannelLeave  EventType = "CHANNEL_LEAVE"
	EventMessageSend   EventType = "MESSAGE_SEND"
)

// BaseEvent contains common fields for all events
type BaseEvent struct {
	ID        string    `json:"id"`
	Type      EventType `json:"type"`
	Timestamp time.Time `json:"timestamp"`
}

// ChannelEvent represents channel-related events
type ChannelEvent struct {
	BaseEvent
	Channel   *models.Channel `json:"channel"`
	Username  string          `json:"username"`
	Operation string          `json:"operation"`
}

// MessageEvent represents message-related events
type MessageEvent struct {
	BaseEvent
	Message   *models.Message `json:"message"`
	ChannelID string          `json:"channel_id"`
}

// Event interface ensures all events have common methods
type Event interface {
	GetID() string
	GetType() EventType
	GetTimestamp() time.Time
}
