package database

import (
	"context"
	"database/sql"
	"fmt"
	"rtc-nb/backend/internal/models"
)

type Store struct {
	db         *sql.DB
	statements *Statements
}

func NewStore(db *sql.DB) (*Store, error) {
	stmts, err := PrepareStatements(db)
	if err != nil {
		return nil, fmt.Errorf("prepare statements: %w", err)
	}

	return &Store{
		db:         db,
		statements: stmts,
	}, nil
}

func (s *Store) Close() error {
	s.statements.CloseStatements()
	return s.db.Close()
}

// User operations
func (s *Store) CreateUser(ctx context.Context, user *models.User) error {
	_, err := s.statements.InsertUser.ExecContext(ctx, user.Username, user.HashedPassword)
	if err != nil {
		if IsUniqueViolation(err) {
			return fmt.Errorf("username already exists: %w", err)
		}
		return fmt.Errorf("failed to create user: %w", err)
	}
	return nil
}

func (s *Store) GetUser(ctx context.Context, username string) (*models.User, error) {
	user := &models.User{}
	err := s.statements.SelectUser.QueryRowContext(ctx, username).Scan(
		&user.Username,
		&user.HashedPassword,
		&user.CreatedAt,
		&user.LastSeen,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return user, err
}

// Channel operations
func (s *Store) CreateChannel(ctx context.Context, channel *models.Channel) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	user, err := s.GetUser(ctx, channel.CreatedBy)
	if err != nil {
		return fmt.Errorf("failed to verify creator: %w", err)
	}
	if user == nil {
		return fmt.Errorf("creator user does not exist")
	}
	_, err = tx.StmtContext(ctx, s.statements.InsertChannel).ExecContext(ctx,
		channel.Name,
		channel.IsPrivate,
		channel.Description,
		channel.HashedPassword,
		channel.CreatedBy,
	)
	if err != nil {
		if IsUniqueViolation(err) {
			return fmt.Errorf("channel name already exists: %w", err)
		}
		if IsStringTooLong(err) {
			return fmt.Errorf("channel name or description too long: %w", err)
		}
		return fmt.Errorf("failed to create channel: %w", err)
	}

	// Add creator as admin
	_, err = tx.StmtContext(ctx, s.statements.AddChannelMember).ExecContext(ctx,
		channel.Name,
		channel.CreatedBy,
		true,
	)
	if err != nil {
		if IsForeignKeyViolation(err) {
			return fmt.Errorf("invalid creator username: %w", err)
		}
		return fmt.Errorf("failed to add channel creator: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (s *Store) GetChannel(ctx context.Context, channelName string) (*models.Channel, error) {
	channel := &models.Channel{
		Members: make(map[string]*models.ChannelMember),
	}
	err := s.statements.SelectChannel.QueryRowContext(ctx, channelName).Scan(
		&channel.Name,
		&channel.IsPrivate,
		&channel.Description,
		&channel.CreatedBy,
		&channel.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err := s.loadChannelMembers(ctx, channel); err != nil {
		return nil, fmt.Errorf("failed to load channel members: %w", err)
	}
	return channel, err
}

func (s *Store) GetChannels(ctx context.Context) ([]*models.Channel, error) {

	rows, err := s.statements.SelectChannels.QueryContext(ctx)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query channels: %w", err)
	}
	defer rows.Close()

	channels := []*models.Channel{}
	for rows.Next() {
		channel := &models.Channel{
			Members: make(map[string]*models.ChannelMember),
		}
		err := rows.Scan(
			&channel.Name,
			&channel.IsPrivate,
			&channel.Description,
			&channel.CreatedBy,
			&channel.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan channel row: %w", err)
		}

		if err := s.loadChannelMembers(ctx, channel); err != nil {
			return nil, fmt.Errorf("failed to load channel members: %w", err)
		}
		channels = append(channels, channel)
	}

	return channels, nil
}

func (s *Store) loadChannelMembers(ctx context.Context, channel *models.Channel) error {
	rows, err := s.statements.SelectChannelMembers.QueryContext(ctx, channel.Name)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		member := &models.ChannelMember{}
		err := rows.Scan(
			&member.Username,
			&member.IsAdmin,
			&member.JoinedAt,
			&member.LastMessage,
		)
		if err != nil {
			return err
		}
		channel.Members[member.Username] = member
	}
	return nil
}

func (s *Store) DeleteChannel(ctx context.Context, channelName string) error {
	_, err := s.statements.DeleteChannel.ExecContext(ctx, channelName)
	return err
}

func (s *Store) UpdateChannel(ctx context.Context, channel *models.Channel) error {
	_, err := s.statements.UpdateChannel.ExecContext(ctx, channel.Name, channel.IsPrivate, channel.Description, channel.HashedPassword)
	return err
}

func (s *Store) AddChannelMember(ctx context.Context, channelName string, member *models.ChannelMember) error {
	_, err := s.statements.AddChannelMember.ExecContext(ctx, channelName, member.Username, member.IsAdmin)
	return err
}

func (s *Store) RemoveChannelMember(ctx context.Context, channelName string, username string) error {
	_, err := s.statements.RemoveChannelMember.ExecContext(ctx, channelName, username)
	return err
}

func (s *Store) IsUserAdmin(ctx context.Context, channelName string, username string) (bool, error) {
	var isAdmin bool
	err := s.statements.IsUserAdmin.QueryRowContext(ctx, channelName, username).Scan(&isAdmin)
	return isAdmin, err
}
