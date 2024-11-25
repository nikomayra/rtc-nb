package operations

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"rtc-nb/backend/internal/models"
)

// Adds a new user to PostgreSQL DB
func AddUser(user *models.User) error {
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
}

func GetUser(username string) (*models.User, error) {
	if username == "" {
		return nil, errors.New("username cannot be empty")
	}

	var user models.User
	err := statements.selectUser.QueryRow(username).Scan(
		&user.Username,
		&user.HashedPassword,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("username %s not found", user.Username)
		}
		return nil, fmt.Errorf("failed to get user from database: %w", err)
	}

	log.Printf("Successfully fetched user %q from database", username)
	return &user, nil
}
