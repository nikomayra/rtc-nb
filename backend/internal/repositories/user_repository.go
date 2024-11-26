package repositories

import (
	"context"

	"rtc-nb/backend/internal/models"
)

// UserRepository defines the interface for user data access operations.
type UserRepository interface {
	AddUser(ctx context.Context, user models.User) (models.User, error)
	GetUser(ctx context.Context, username string) (models.User, error)
	UpdateUser(ctx context.Context, username string, user models.User) (models.User, error)
	DeleteUser(ctx context.Context, username string) error
}
