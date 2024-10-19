package chat

// Define chat-related data structures (e.g., messages, users)

// Message represents a chat message structure
type Message struct {
	User    string `json:"user"`    // Username of the sender
	Content string `json:"content"` // Content of the message
}
