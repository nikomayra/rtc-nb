package repositories

import (
	"context"
	"errors"
	"fmt"
	"log"

	"rtc-nb/backend/internal/models"
)

// UserRepository defines the interface for user data access operations.
type UserRepository interface {
	CreateUser(ctx context.Context, user models.User) (models.User, error)
	GetUser(ctx context.Context, username string) (models.User, error)
	UpdateUser(ctx context.Context, username string, user models.User) (models.User, error)
	DeleteUser(ctx context.Context, username string) error
}

func (ur *userRepository) CreateUser(ctx context.Context, user models.User) (models.User, error) {
	if user == nil {
		return errors.New("user cannot be nil")
	}

	result, err := statements.insertUser.Exec(user.Username, user.HashedPassword)
	if err != nil {
		if isUniqueViolation(err) {
			return fmt.Errorf("username %s already exists", user.Username)
		}
		if isStringTooLong(err) {
			return fmt.Errorf("username or password too long")
		}
		return fmt.Errorf("failed to add user: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected != 1 {
		return fmt.Errorf("expected 1 row affected, got %d", rowsAffected)
	}

	log.Printf("Successfully added user %q to database", user.Username)
	return nil
	return user, nil
}

func (ur *UserRepository) GetUser(ctx context.Context, username string) (models.User, error) {
	// Logic to get a user by ID
	return models.User{}, nil
}

func (ur *UserRepository) UpdateUser(ctx context.Context, username string, user models.User) (models.User, error) {
	// Logic to update a user
	return user, nil
}

func (ur *UserRepository) DeleteUser(ctx context.Context, username string) error {
	// Logic to delete a user
	return nil
}
