package models

import (
	"fmt"
	"time"
)

// Represents an authenticated user in the system
type User struct {
	Username       string    `json:"username"`
	HashedPassword string    `json:"-"` // Never expose in JSON
	IsOnline       bool      `json:"is_online"`
	CreatedAt      time.Time `json:"created_at"`
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
		IsOnline:       true,
		CreatedAt:      now,
	}, nil
}
