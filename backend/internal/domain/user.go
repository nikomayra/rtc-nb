package domain

import (
	"fmt"
	"rtc-nb/backend/websocket/connection"
	"time"
)

// Represents an authenticated user in the system
type User struct {
	Username       string    `json:"username"`
	HashedPassword string    `json:"-"` // Never expose in JSON
	CreatedAt      time.Time `json:"createdAt"`
	LastSeen       time.Time `json:"lastSeen"`
}

// Represents the current state of a user
type UserStatus struct {
	Username string    `json:"username"`
	IsOnline bool      `json:"isOnline"`
	LastSeen time.Time `json:"lastSeen"`
}

// NewUser creates a new user with proper initialization
func NewUser(username, hashedPassword string) (*User, error) {
	if username == "" {
		return nil, fmt.Errorf("username cannot be empty")
	}
	if hashedPassword == "" {
		return nil, fmt.Errorf("password cannot be empty")
	}

	now := time.Now().UTC()
	return &User{
		Username:       username,
		HashedPassword: hashedPassword,
		CreatedAt:      now,
		LastSeen:       now,
	}, nil
}

func (u *User) GetStatus(connectionManager *connection.ConnectionManager) UserStatus {
	_, isOnline := connectionManager.GetConnection(u.Username)
	return UserStatus{
		Username: u.Username,
		IsOnline: isOnline,
		LastSeen: u.LastSeen,
	}
}
