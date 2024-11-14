package database

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"rtc-nb/backend/internal/models"
)

// AddUser adds a new user to PostgreSQL
func AddUser(user *models.User) error {
	if user == nil {
		return errors.New("user cannot be nil")
	}

	result, err := statements.insertUser.Exec(user.Username, user.Password)
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
		&user.Password,
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

// CreateChannel creates a new channel and adds the creator
func CreateChannel(channel *models.Channel) error {
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Insert channel
	_, err = tx.Stmt(statements.insertChannel).Exec(
		channel.Name,
		channel.Password,
		channel.Description,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return fmt.Errorf("channel %s already exists", channel.Name)
		}
		if isStringTooLong(err) {
			return fmt.Errorf("channel name, password, or description too long")
		}
		return fmt.Errorf("failed to create channel: %w", err)
	}

	// Add creator as member
	_, err = tx.Stmt(statements.addChannelMember).Exec(
		channel.Name,
		channel.Users[0],
		true,
	)
	if err != nil {
		if isForeignKeyViolation(err) {
			return fmt.Errorf("user %s does not exist", channel.Users[0])
		}
		return fmt.Errorf("failed to add channel creator: %w", err)
	}

	return tx.Commit()
}
