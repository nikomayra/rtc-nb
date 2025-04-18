package models

import (
	"errors"
	"rtc-nb/backend/internal/auth"
	"sync"
	"time"
)

var (
	ErrEmptyChannelName = errors.New("channel name cannot be empty")
	ErrEmptyCreator     = errors.New("creator cannot be empty")
	ErrMemberNotFound   = errors.New("member not found in channel")
	ErrMemberExists     = errors.New("member already exists in channel")
	ErrEmptyUsername    = errors.New("username cannot be empty")
)

// Represents a chat room
type Channel struct {
	Name           string    `json:"name"`
	IsPrivate      bool      `json:"is_private"`
	Description    *string   `json:"description,omitempty"`
	HashedPassword *string   `json:"-"` // Never expose in JSON
	CreatedBy      string    `json:"created_by"`
	CreatedAt      time.Time `json:"created_at"`

	mu      sync.RWMutex              `json:"-"`
	Members map[string]*ChannelMember `json:"members"` // username -> member data
}

// Represents a user's status and metadata within a channel
type ChannelMember struct {
	Username string    `json:"username"`
	IsAdmin  bool      `json:"is_admin"`
	JoinedAt time.Time `json:"joined_at"`
}

func NewChannel(name string, creator string, description, password *string) (*Channel, error) {
	var isPrivate bool
	if password == nil {
		isPrivate = false
	} else {
		isPrivate = true
	}

	ch := &Channel{
		Name:           name,
		IsPrivate:      isPrivate,
		Description:    description,
		HashedPassword: password,
		CreatedBy:      creator,
		CreatedAt:      time.Now().UTC(),
		Members:        make(map[string]*ChannelMember),
	}

	if err := ch.AddMember(creator, true); err != nil {
		return nil, err
	}
	return ch, nil
}

func (c *Channel) Validate() error {
	if c.Name == "" {
		return ErrEmptyChannelName
	}
	if c.CreatedBy == "" {
		return ErrEmptyCreator
	}

	return nil
}

func (c *Channel) AddMember(username string, isAdmin bool) error {
	if username == "" {
		return ErrEmptyUsername
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if _, exists := c.Members[username]; exists {
		return ErrMemberExists
	}

	c.Members[username] = &ChannelMember{
		Username: username,
		IsAdmin:  isAdmin,
		JoinedAt: time.Now().UTC(),
	}
	return nil
}

func (c *Channel) RemoveMember(username string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, exists := c.Members[username]; !exists {
		return ErrMemberNotFound
	}

	delete(c.Members, username)
	return nil
}

func (c *Channel) IsAdmin(username string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	member, exists := c.Members[username]
	return exists && member.IsAdmin
}

func (c *Channel) GetMember(username string) (*ChannelMember, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	member, exists := c.Members[username]
	if !exists {
		return nil, ErrMemberNotFound
	}
	return member, nil
}

func (c *Channel) GetMembers() map[string]*ChannelMember {
	c.mu.RLock()
	defer c.mu.RUnlock()

	members := c.Members
	return members
}

func (c *Channel) GetMembersUsernames() []string {
	c.mu.RLock()
	defer c.mu.RUnlock()

	usernames := make([]string, 0, len(c.Members))
	for username := range c.Members {
		usernames = append(usernames, username)
	}
	return usernames
}

func (c *Channel) GetAdminsUsernames() []string {
	c.mu.RLock()
	defer c.mu.RUnlock()

	adminsUsernames := make([]string, 0, len(c.Members))
	for username := range c.Members {
		if c.Members[username].IsAdmin {
			adminsUsernames = append(adminsUsernames, username)
		}
	}
	return adminsUsernames
}

func (c *Channel) ValidatePassword(password string) bool {
	if c.HashedPassword == nil {
		return true // No password required
	}
	return auth.CheckPassword(*c.HashedPassword, password) == nil
}
