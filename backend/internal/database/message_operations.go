package database

import (
	"errors"
	"fmt"
	"rtc-nb/backend/internal/models"
)

func SaveMessage(message *models.Message) error {
	if message == nil {
		return errors.New("message cannot be nil")
	}

	_, err := statements.insertMessage.Exec(
		message.ChannelName,
		message.Username,
	)
	if err != nil {
		return fmt.Errorf("failed to save message: %w", err)
	}

	return nil
}
