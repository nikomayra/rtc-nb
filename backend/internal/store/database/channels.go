package models

import (
	"rtc-nb/backend/internal/domain"
	"time"
)

// ChannelDB represents the database model for a channel
type ChannelDB struct {
	Name           string    `db:"name"`
	IsPrivate      bool      `db:"is_private"`
	Description    *string   `db:"description"`
	HashedPassword *string   `db:"hashed_password"`
	CreatedBy      string    `db:"created_by"`
	CreatedAt      time.Time `db:"created_at"`
}

// ToEntity converts database model to domain entity
func (c *ChannelDB) ToEntity() *domain.Channel {
	return &domain.Channel{
		Name:           c.Name,
		IsPrivate:      c.IsPrivate,
		Description:    c.Description,
		HashedPassword: c.HashedPassword,
		CreatedBy:      c.CreatedBy,
		CreatedAt:      c.CreatedAt,
		Members:        make(map[string]*domain.ChannelMember),
	}
}

// FromEntity creates a database model from domain entity
func FromEntity(c *domain.Channel) *ChannelDB {
	return &ChannelDB{
		Name:           c.Name,
		IsPrivate:      c.IsPrivate,
		Description:    c.Description,
		HashedPassword: c.HashedPassword,
		CreatedBy:      c.CreatedBy,
		CreatedAt:      c.CreatedAt,
	}
}
