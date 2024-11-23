package database

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"rtc-nb/backend/internal/models"
)

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

func AddUserToChannel(channelName, username string, isAdmin bool) error {
	if username == "" || channelName == "" {
		return errors.New("username or channel name cannot be empty")
	}

	result, err := statements.addChannelMember.Exec(channelName, username, isAdmin)
	if err != nil {
		if isForeignKeyViolation(err) {
			return fmt.Errorf("username %s does not exist", username)
		}
		if isStringTooLong(err) {
			return fmt.Errorf("username or channel name too long")
		}
		return fmt.Errorf("failed to add user to channel: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected != 1 {
		return fmt.Errorf("expected 1 row affected, got %d", rowsAffected)
	}

	log.Printf("Successfully added user %q to channel %q", username, channelName)
	return nil
}

func RemoveUserFromChannel(channelName, username string) error {
	if username == "" || channelName == "" {
		return errors.New("username or channel name cannot be empty")
	}

	result, err := statements.removeChannelMember.Exec(channelName, username)
	if err != nil {
		if isForeignKeyViolation(err) {
			return fmt.Errorf("username %s does not exist", username)
		}
		return fmt.Errorf("failed to remove user from channel: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected != 1 {
		return fmt.Errorf("expected 1 row affected, got %d", rowsAffected)
	}

	log.Printf("Successfully removed user %q from channel %q", username, channelName)
	return nil
}

func GetChannels() ([]*models.Channel, error) {
	rows, err := statements.selectChannels.Query()
	if err != nil {
		return nil, fmt.Errorf("failed to get channels: %w", err)
	}
	defer rows.Close()

	var channels []*models.Channel
	for rows.Next() {
		var channel models.Channel
		if err := rows.Scan(&channel.Name, &channel.Password, &channel.Description); err != nil {
			return nil, fmt.Errorf("failed to scan channel: %w", err)
		}
		channels = append(channels, &channel)
	}

	return channels, nil
}

func GetChannel(channelName string) (*models.Channel, error) {
	if channelName == "" {
		return nil, errors.New("channel name cannot be empty")
	}

	var channel models.Channel
	err := statements.selectChannel.QueryRow(channelName).Scan(
		&channel.Name,
		&channel.Password,
		&channel.Description,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("channel %s not found", channelName)
		}
		return nil, fmt.Errorf("failed to get channel: %w", err)
	}

	return &channel, nil
}

func DeleteChannel(channelName string) error {
	if channelName == "" {
		return errors.New("channel name cannot be empty")
	}

	_, err := statements.deleteChannel.Exec(channelName)
	if err != nil {
		return fmt.Errorf("failed to delete channel: %w", err)
	}

	return nil
}
