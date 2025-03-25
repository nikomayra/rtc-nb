package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
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

	// Create a map to track which channels we've already verified
	verifiedChannels := make(map[string]bool)

	for _, msg := range messages {
		// Skip sketch messages (they have their own storage mechanism)
		if msg.Type == models.MessageTypeSketch {
			continue
		}

		// Skip MemberUpdate messages as these shouldn't be persisted
		if msg.Type == models.MessageTypeMemberUpdate {
			continue
		}

		// Check if channel exists before inserting message
		if !verifiedChannels[msg.ChannelName] {
			var exists bool
			err := tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM channels WHERE name = $1)", msg.ChannelName).Scan(&exists)
			if err != nil {
				return fmt.Errorf("failed to check if channel exists: %w", err)
			}

			if !exists {
				// Skip this message as channel doesn't exist
				log.Printf("Skipping message for non-existent channel: %s", msg.ChannelName)
				continue
			}

			verifiedChannels[msg.ChannelName] = true
		}

		contentJSON, err := json.Marshal(msg.Content)
		if err != nil {
			return fmt.Errorf("failed to marshal message content: %w", err)
		}

		_, err = tx.StmtContext(ctx, s.statements.InsertMessage).ExecContext(ctx, msg.ID, msg.ChannelName, msg.Username, msg.Type, contentJSON, msg.Timestamp)
		if err != nil {
			return fmt.Errorf("failed to insert message: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (s *Store) GetMessages(ctx context.Context, channelName string) ([]*models.Message, error) {
	rows, err := s.statements.SelectMessages.QueryContext(ctx, channelName)
	if err != nil {
		return nil, fmt.Errorf("failed to query messages: %w", err)
	}
	defer rows.Close()

	messages := []*models.Message{}
	for rows.Next() {
		msg := &models.Message{}
		var contentJSON []byte
		err := rows.Scan(&msg.ID, &msg.ChannelName, &msg.Username, &msg.Type, &contentJSON, &msg.Timestamp)
		if err != nil {
			return nil, fmt.Errorf("failed to scan message row: %w", err)
		}

		err = json.Unmarshal(contentJSON, &msg.Content)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal message content: %w", err)
		}
		messages = append(messages, msg)
	}

	return messages, nil
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
		)
		if err != nil {
			return err
		}
		channel.Members[member.Username] = member
	}
	return nil
}

func (s *Store) GetChannelMembers(ctx context.Context, channelName string) ([]*models.ChannelMember, error) {
	rows, err := s.statements.SelectChannelMembers.QueryContext(ctx, channelName)
	if err != nil {
		return nil, fmt.Errorf("failed to query channel members: %w", err)
	}
	defer rows.Close()

	members := []*models.ChannelMember{}
	for rows.Next() {
		member := &models.ChannelMember{}
		err := rows.Scan(&member.Username, &member.IsAdmin, &member.JoinedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan channel member row: %w", err)
		}
		members = append(members, member)
	}
	return members, nil
}

func (s *Store) DeleteChannel(ctx context.Context, channelName string) error {
	result, err := s.statements.DeleteChannel.ExecContext(ctx, channelName)
	if err != nil {
		return fmt.Errorf("failed to execute delete channel: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("no channel found with name: %s", channelName)
	}

	return nil
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
	regionsJSON, err := json.Marshal(sketch.Regions)
	if err != nil {
		return fmt.Errorf("failed to marshal regions: %w", err)
	}
	_, err = s.statements.InsertSketch.ExecContext(ctx, sketch.ID, sketch.ChannelName, sketch.DisplayName, sketch.Width, sketch.Height, regionsJSON, sketch.CreatedBy)

	if err != nil {
		return fmt.Errorf("failed to insert sketch: %w", err)
	}
	return nil
}

func (s *Store) UpdateSketchWithTx(ctx context.Context, tx *sql.Tx, sketch *models.Sketch) error {
	currentSketch, err := s.GetSketch(ctx, sketch.ID)
	if err != nil {
		return fmt.Errorf("select sketch: %w", err)
	}

	// Merge regions
	for k, v := range sketch.Regions {
		currentSketch.Regions[k] = v
	}

	var updatedRegionsJSON []byte
	updatedRegionsJSON, err = json.Marshal(currentSketch.Regions)
	if err != nil {
		return fmt.Errorf("failed to marshal updated regions: %w", err)
	}

	_, err = tx.StmtContext(ctx, s.statements.UpdateSketchRegions).
		ExecContext(ctx, sketch.ID, updatedRegionsJSON)
	if err != nil {
		return fmt.Errorf("update sketch regions: %w", err)
	}

	return nil
}

func (s *Store) GetSketch(ctx context.Context, sketchID string) (*models.Sketch, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	sketch := &models.Sketch{
		Regions: make(map[string]models.Region),
	}
	var regionsJSON []byte
	err := s.statements.SelectSketchByID.QueryRowContext(ctx, sketchID).Scan(
		&sketch.ID,
		&sketch.ChannelName,
		&sketch.DisplayName,
		&sketch.Width,
		&sketch.Height,
		&regionsJSON,
		&sketch.CreatedAt,
		&sketch.CreatedBy,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get sketch: %w", err)
	}
	if err := json.Unmarshal(regionsJSON, &sketch.Regions); err != nil {
		return nil, fmt.Errorf("failed to unmarshal regions: %w", err)
	}
	return sketch, nil
}

// Returns all sketches for a channel without the regions
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
		sketch := &models.Sketch{
			Regions: make(map[string]models.Region), // Initialize with empty regions map
		}
		err := rows.Scan(&sketch.ID, &sketch.ChannelName, &sketch.DisplayName, &sketch.Width, &sketch.Height, &sketch.CreatedAt, &sketch.CreatedBy)
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

func (s *Store) ClearSketchRegions(ctx context.Context, sketchID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	result, err := s.statements.ClearSketchRegions.ExecContext(ctx, sketchID)
	if err != nil {
		return fmt.Errorf("failed to clear sketch regions: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("no sketch found with id: %s", sketchID)
	}

	return nil
}

func (s *Store) BeginTx(ctx context.Context) (*sql.Tx, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.db.BeginTx(ctx, nil)
}

func (s *Store) UpdateChannelMemberRole(ctx context.Context, channelName, username string, isAdmin bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.statements.UpdateChannelMemberRole.ExecContext(ctx, channelName, username, isAdmin)
	return err
}

func (s *Store) GetChannelAdmins(ctx context.Context, channelName string) ([]string, error) {
	rows, err := s.statements.GetChannelAdmins.QueryContext(ctx, channelName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var admins []string
	for rows.Next() {
		var username string
		if err := rows.Scan(&username); err != nil {
			return nil, err
		}
		admins = append(admins, username)
	}
	return admins, nil
}

// DeleteChannelMembers removes all members from a channel
func (s *Store) DeleteChannelMembers(ctx context.Context, channelName string) error {
	_, err := s.db.ExecContext(ctx, "DELETE FROM channel_member WHERE channel_name = $1", channelName)
	if err != nil {
		return fmt.Errorf("failed to delete channel members: %w", err)
	}
	return nil
}
