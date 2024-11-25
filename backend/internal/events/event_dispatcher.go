package events

// EventDispatcher defines the interface for dispatching and handling events.
type EventDispatcher interface {
	Dispatch(event Event) error
	Subscribe(eventType string, handler EventHandler) error
}

// Event represents an event in the system.
type Event struct {
	Type      string `json:"type"`
	Payload   string `json:"payload"`
	Timestamp string `json:"timestamp"`
}

// EventHandler defines an interface for handling events.
type EventHandler interface {
	HandleEvent(event Event) error
}
