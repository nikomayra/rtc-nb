package events

import (
	"encoding/json"
	"errors"
)

type EventType string

const (
	EventTypeChannel EventType = "CHANNEL"
	EventTypeMessage EventType = "MESSAGE"
	EventTypeUser    EventType = "USER"
)

type OperationType string

const (
	// Channel operations
	OperationChannelCreate OperationType = "CREATE"
	OperationChannelJoin   OperationType = "JOIN"
	OperationChannelLeave  OperationType = "LEAVE"
	OperationChannelDelete OperationType = "DELETE"

	// Message operations
	OperationMessageSend   OperationType = "SEND"
	OperationMessageEdit   OperationType = "EDIT"
	OperationMessageDelete OperationType = "DELETE"
)

type Event struct {
	Type    EventType       `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type ChannelEventPayload struct {
	Operation OperationType `json:"operation"` // "CREATE", "JOIN", "LEAVE", "DELETE"
	Channel   string        `json:"channel"`
	User      string        `json:"user"`
	Data      struct {
		Description *string `json:"description,omitempty"`
		Password    *string `json:"password,omitempty"`
	} `json:"data,omitempty"`
}

type MessageEventPayload struct {
	Operation OperationType   `json:"operation"` // "SEND", "EDIT", "DELETE"
	Channel   string          `json:"channel"`
	User      string          `json:"user"`
	Message   json.RawMessage `json:"message,omitempty"`
}

func ParseEvent(data []byte) (*Event, error) {
	var event Event
	if err := json.Unmarshal(data, &event); err != nil {
		return nil, err
	}
	return &event, nil
}

func (e *Event) ParseChannelPayload() (*ChannelEventPayload, error) {
	if e.Type != EventTypeChannel {
		return nil, errors.New("event is not a channel event")
	}

	var payload ChannelEventPayload
	if err := json.Unmarshal(e.Payload, &payload); err != nil {
		return nil, err
	}
	return &payload, nil
}

func (e *Event) ParseMessagePayload() (*MessageEventPayload, error) {
	if e.Type != EventTypeMessage {
		return nil, errors.New("event is not a message event")
	}

	var payload MessageEventPayload
	if err := json.Unmarshal(e.Payload, &payload); err != nil {
		return nil, err
	}
	return &payload, nil
}
