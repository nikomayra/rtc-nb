package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	Username string `json:"username"` //Usernames are unique
	Password string `json:"password"` //This is hashed
}

func NewUser(username, password string) *User {
	return &User{
		Username: username,
		Password: password,
	}
}

type Channel struct {
	Name        string    `json:"name"`        //Channel names are unique
	Password    *string   `json:"password"`    //optional value | nil
	Description *string   `json:"description"` //optional value | nil
	CreatedAt   time.Time `json:"createdAt"`
	Users       []string  `json:"users"`
	Admins      []string  `json:"admins"`
}

func NewChannel(name, creator string, description, password *string) *Channel {
	return &Channel{
		Name:        name,
		Password:    password,
		Description: description,
		CreatedAt:   time.Now(),
		Users:       []string{},
		Admins:      []string{creator},
	}
}

type MessageType int

const (
	MessageTypeText MessageType = iota
	MessageTypeImage
	MessageTypeVideo
	MessageTypeAudio
)

type Message struct {
	ID          string      `json:"id"`
	ChannelName string      `json:"channelName"`
	Username    string      `json:"username"`
	Type        MessageType `json:"type"`
	Content     interface{} `json:"content"`
	Timestamp   time.Time   `json:"timestamp"`
}

type TextMessage struct {
	Text string `json:"text"`
}

func NewTextMessage(channelName, username, text string) *Message {
	return &Message{
		ID:          uuid.NewString(),
		ChannelName: channelName,
		Username:    username,
		Type:        MessageTypeText,
		Content:     &TextMessage{Text: text},
		Timestamp:   time.Now(),
	}
}

// type ImageMessage struct {
//     URL string `json:"url"`
// }

// type VideoMessage struct {
//     URL string `json:"url"`
// }

// type AudioMessage struct {
//     URL string `json:"url"`
// }
