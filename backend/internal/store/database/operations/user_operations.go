package operations

import (
	"database/sql"
	"errors"
	"fmt"

	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/internal/store/database"
	"rtc-nb/backend/internal/store/database/statements"
)

type UserOperations struct {
	statements *statements.UserStatements
}

func NewUserOperations(statements *statements.UserStatements) *UserOperations {
	return &UserOperations{
		statements: statements,
	}
}

func (uo *UserOperations) AddUser(user models.User) error {
	if user.Username == "" {
		return errors.New("username cannot be empty")
	}
	result, err := uo.statements.InsertUser.Exec(user.Username, user.HashedPassword)
	if err != nil {
		if database.IsUniqueViolation(err) {
			return fmt.Errorf("username %s already exists", user.Username)
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
	return nil
}

func (uo *UserOperations) GetUser(username string) (models.User, error) {
	if username == "" {
		return models.User{}, errors.New("username cannot be empty")
	}
	var user models.User
	err := uo.statements.SelectUser.QueryRow(username).Scan(
		&user.Username,
		&user.HashedPassword,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.User{}, fmt.Errorf("user %s not found", username)
		}
		return models.User{}, fmt.Errorf("failed to get user: %w", err)
	}
	return user, nil
}

func (uo *UserOperations) UpdateUser(username string, hashedPassword string) error {
	if username == "" {
		return errors.New("username cannot be empty")
	}
	result, err := uo.statements.UpdateUser.Exec(username, hashedPassword)
	if err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rowsAffected != 1 {
		return fmt.Errorf("user %s not found", username)
	}
	return nil
}

func (uo *UserOperations) DeleteUser(username string) error {
	if username == "" {
		return errors.New("username cannot be empty")
	}
	result, err := uo.statements.DeleteUser.Exec(username)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rowsAffected != 1 {
		return fmt.Errorf("user %s not found", username)
	}
	return nil
}
