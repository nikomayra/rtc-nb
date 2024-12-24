package database

import (
	"context"
	"database/sql"
	"fmt"
	"rtc-nb/backend/internal/models"
	"sync"
)

type Store struct {
	db         *sql.DB
	statements *Statements
	mu         sync.Mutex
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

func (s *Store) BatchInsertMessages(ctx context.Context, messages []*models.Message) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	for _, msg := range messages {
		if msg.Type == models.MessageTypeSketch {
			continue
		}
		_, err := tx.StmtContext(ctx, s.statements.InsertMessage).ExecContext(ctx, msg.ID, msg.ChannelName, msg.Username, msg.Type, msg.Content, msg.Timestamp)
		if err != nil {
			return fmt.Errorf("failed to insert message: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
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

func (s *Store) DeleteUser(ctx context.Context, username string) error {
	_, err := s.statements.DeleteUser.ExecContext(ctx, username)
	return err
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
		&channel.HashedPassword,
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
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.statements.UpdateChannel.ExecContext(ctx, channel.Name, channel.IsPrivate, channel.Description, channel.HashedPassword)
	return err
}

func (s *Store) AddChannelMember(ctx context.Context, channelName string, member *models.ChannelMember) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.statements.AddChannelMember.ExecContext(ctx, channelName, member.Username, member.IsAdmin)
	return err
}

func (s *Store) RemoveChannelMember(ctx context.Context, channelName string, username string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.statements.RemoveChannelMember.ExecContext(ctx, channelName, username)
	return err
}

func (s *Store) IsUserAdmin(ctx context.Context, channelName string, username string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.statements == nil || s.statements.IsUserAdmin == nil {
		return false, fmt.Errorf("IsUserAdmin statement not initialized")
	}

	var isAdmin bool
	err := s.statements.IsUserAdmin.QueryRowContext(ctx, channelName, username).Scan(&isAdmin)
	if err == sql.ErrNoRows {
		return false, nil // User is not a member of the channel
	}
	if err != nil {
		return false, fmt.Errorf("query IsUserAdmin: %w", err)
	}
	return isAdmin, nil
}

func (s *Store) GetUserChannel(ctx context.Context, username string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var channelName string
	err := s.statements.SelectUserChannel.QueryRowContext(ctx, username).Scan(&channelName)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("failed to get user channel: %w", err)
	}
	return channelName, nil
}

// Sketch operations
func (s *Store) CreateSketch(ctx context.Context, sketch *models.Sketch) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.statements.InsertSketch.ExecContext(ctx, sketch.ID, sketch.ChannelName, sketch.Width, sketch.Height, sketch.ToBytes(), sketch.CreatedBy)
	return err
}

func (s *Store) UpdateSketch(ctx context.Context, sketch *models.Sketch) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.statements.UpdateSketch.ExecContext(ctx, sketch.ID, sketch.ToBytes())
	return err
}

func (s *Store) GetSketch(ctx context.Context, sketchID string) (*models.Sketch, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	sketch := &models.Sketch{}
	var pixels []byte
	err := s.statements.SelectSketchByID.QueryRowContext(ctx, sketchID).Scan(
		&sketch.ID,
		&sketch.ChannelName,
		&sketch.Width,
		&sketch.Height,
		&pixels,
		&sketch.CreatedAt,
		&sketch.CreatedBy,
	)
	if err != nil {
		return nil, err
	}
	sketch.FromBytes(pixels)
	return sketch, nil
}

// Returns all sketches for a channel without the pixels
func (s *Store) GetSketches(ctx context.Context, channelName string) ([]*models.Sketch, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	rows, err := s.statements.SelectSketches.QueryContext(ctx, channelName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sketches := []*models.Sketch{}
	for rows.Next() {
		sketch := &models.Sketch{}
		err := rows.Scan(&sketch.ID, &sketch.ChannelName, &sketch.Width, &sketch.Height, &sketch.CreatedAt, &sketch.CreatedBy)
		if err != nil {
			return nil, err
		}
		sketches = append(sketches, sketch)
	}
	return sketches, nil
}

func (s *Store) DeleteSketch(ctx context.Context, sketchID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.statements.DeleteSketch.ExecContext(ctx, sketchID)
	return err
}

func (s *Store) BeginTx(ctx context.Context) (*sql.Tx, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.db.BeginTx(ctx, nil)
}
