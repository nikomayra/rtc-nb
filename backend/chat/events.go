package events

import (
	"rtc-nb/backend/internal/domain"
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
	Channel   *domain.Channel `json:"channel"`
	Username  string          `json:"username"`
	Operation string          `json:"operation"`
}

func (ce *ChannelEvent) GetID() string {
	return ce.BaseEvent.ID
}

func (ce *ChannelEvent) GetType() EventType {
	return ce.BaseEvent.Type
}

func (ce *ChannelEvent) GetTimestamp() time.Time {
	return ce.BaseEvent.Timestamp
}

// MessageEvent represents message-related events
type MessageEvent struct {
	BaseEvent
	Message   *domain.Message `json:"message"`
	ChannelID string          `json:"channel_id"`
}

func (me *MessageEvent) GetID() string {
	return me.BaseEvent.ID
}

func (me *MessageEvent) GetType() EventType {
	return me.BaseEvent.Type
}

func (me *MessageEvent) GetTimestamp() time.Time {
	return me.BaseEvent.Timestamp
}

// Event interface ensures all events have common methods
type Event interface {
	GetID() string
	GetType() EventType
	GetTimestamp() time.Time
}
