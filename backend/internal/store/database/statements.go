package database

import (
	"database/sql"
	"fmt"
)

type Statements struct {
	InsertUser *sql.Stmt // username, hashed_password
	SelectUser *sql.Stmt // username
	DeleteUser *sql.Stmt // username

	// TODO: Implement for idle system maybe
	UpsertUserStatus *sql.Stmt // username, is_online
	SelectUserStatus *sql.Stmt // username

	InsertChannel        *sql.Stmt // name, is_private, description, created_by, hashed_password
	SelectChannel        *sql.Stmt // name
	SelectChannels       *sql.Stmt
	UpdateChannel        *sql.Stmt // name, is_private, description, hashed_password
	DeleteChannel        *sql.Stmt // name
	SelectChannelMembers *sql.Stmt // channel_name
	AddChannelMember     *sql.Stmt // channel_name, username, is_admin, joined_at
	RemoveChannelMember  *sql.Stmt // channel_name, username
	IsUserAdmin          *sql.Stmt // channel_name, username

	InsertMessage  *sql.Stmt // id, channel_name, username, message_type, content, timestamp
	SelectMessages *sql.Stmt // channel_name

	SelectUserChannel *sql.Stmt // username

	InsertSketch     *sql.Stmt // id, channel_name, width, height, pixels
	SelectSketchByID *sql.Stmt // id
	SelectSketches   *sql.Stmt // channel_name
	UpdateSketch     *sql.Stmt // id, width, height, pixels
	DeleteSketch     *sql.Stmt // id
}

func PrepareStatements(db *sql.DB) (*Statements, error) {
	s := &Statements{}
	var statements []*sql.Stmt

	prepare := func(query string) (*sql.Stmt, error) {
		stmt, err := db.Prepare(query)
		if err != nil {
			// Clean up any previously prepared statements
			for _, s := range statements {
				s.Close()
			}
			return nil, err
		}
		statements = append(statements, stmt)
		return stmt, nil
	}
	var err error

	// Prepare user statements
	if s.InsertUser, err = prepare(`
        INSERT INTO users (username, hashed_password) 
        VALUES ($1, $2)`); err != nil {
		return nil, fmt.Errorf("prepare insert user: %w", err)
	}

	if s.SelectUser, err = prepare(`
        SELECT username, hashed_password, created_at, last_seen
        FROM users WHERE username = $1`); err != nil {
		return nil, fmt.Errorf("prepare select user: %w", err)
	}

	if s.DeleteUser, err = prepare(`
        DELETE FROM users WHERE username = $1`); err != nil {
		return nil, fmt.Errorf("prepare delete user: %w", err)
	}

	// // Prepare user status statements
	if s.UpsertUserStatus, err = prepare(`
        INSERT INTO user_status (username, is_online, last_seen)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (username) 
        DO UPDATE SET is_online = $2, last_seen = CURRENT_TIMESTAMP`); err != nil {
		return nil, fmt.Errorf("prepare upsert user status: %w", err)
	}

	if s.SelectUserStatus, err = prepare(`
        SELECT username, is_online, last_seen 
        FROM user_status WHERE username = $1`); err != nil {
		return nil, fmt.Errorf("prepare select user status: %w", err)
	}

	// Prepare channel statements
	if s.InsertChannel, err = prepare(`
        INSERT INTO channels (name, is_private, description, hashed_password, created_by) 
        VALUES ($1, $2, $3, $4, $5)`); err != nil {
		return nil, fmt.Errorf("prepare insert channel: %w", err)
	}

	if s.SelectChannel, err = prepare(`
        SELECT name, is_private, description, hashed_password, created_by, created_at 
        FROM channels WHERE name = $1`); err != nil {
		return nil, fmt.Errorf("prepare select channel: %w", err)
	}

	if s.SelectChannels, err = prepare(`
        SELECT name, is_private, description, created_by, created_at 
        FROM channels`); err != nil {
		return nil, fmt.Errorf("prepare select channels: %w", err)
	}

	if s.DeleteChannel, err = prepare(`
        DELETE FROM channels WHERE name = $1`); err != nil {
		return nil, fmt.Errorf("prepare delete channel: %w", err)
	}

	if s.UpdateChannel, err = prepare(`
        UPDATE channels 
        SET is_private = $2, description = $3, hashed_password = $4 
        WHERE name = $1`); err != nil {
		return nil, fmt.Errorf("prepare update channel: %w", err)
	}

	if s.SelectChannelMembers, err = prepare(`
        SELECT username, is_admin, joined_at, last_message
        FROM channel_member WHERE channel_name = $1`); err != nil {
		return nil, fmt.Errorf("prepare select channel members: %w", err)
	}

	if s.AddChannelMember, err = prepare(`
        INSERT INTO channel_member (channel_name, username, is_admin, joined_at) 
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`); err != nil {
		return nil, fmt.Errorf("prepare add channel member: %w", err)
	}

	if s.RemoveChannelMember, err = prepare(`
        DELETE FROM channel_member WHERE channel_name = $1 AND username = $2`); err != nil {
		return nil, fmt.Errorf("prepare remove channel member: %w", err)
	}

	// Prepare message statements
	if s.InsertMessage, err = prepare(`
        INSERT INTO messages (id, channel_name, username, message_type, content, timestamp) 
        VALUES ($1, $2, $3, $4, $5, $6)`); err != nil {
		return nil, fmt.Errorf("prepare insert message: %w", err)
	}

	if s.SelectMessages, err = prepare(`
        SELECT id, channel_name, username, message_type, content, timestamp 
        FROM messages 
        WHERE channel_name = $1 
        ORDER BY timestamp`); err != nil {
		return nil, fmt.Errorf("prepare select messages: %w", err)
	}

	if s.SelectUserChannel, err = prepare(`
        SELECT channel_name 
        FROM channel_member 
        WHERE username = $1
		LIMIT 1`); err != nil {
		return nil, fmt.Errorf("prepare select user channel: %w", err)
	}

	// Prepare IsUserAdmin statement
	if s.IsUserAdmin, err = prepare(`
        SELECT is_admin 
        FROM channel_member 
        WHERE channel_name = $1 AND username = $2`); err != nil {
		return nil, fmt.Errorf("prepare IsUserAdmin statement: %w", err)
	}

	// Prepare sketch statements
	if s.InsertSketch, err = prepare(`
        INSERT INTO sketches (id, channel_name, width, height, pixels, created_by) 
        VALUES ($1, $2, $3, $4, $5, $6)`); err != nil {
		return nil, fmt.Errorf("prepare insert sketch: %w", err)
	}

	if s.SelectSketchByID, err = prepare(`
        SELECT id, channel_name, width, height, pixels, created_at, created_by 
        FROM sketches 
        WHERE id = $1`); err != nil {
		return nil, fmt.Errorf("prepare select sketch: %w", err)
	}

	if s.SelectSketches, err = prepare(`
        SELECT id, channel_name, width, height, created_at, created_by 
        FROM sketches
		WHERE channel_name = $1`); err != nil {
		return nil, fmt.Errorf("prepare select sketches: %w", err)
	}

	if s.UpdateSketch, err = prepare(`
        UPDATE sketches 
        SET pixels = $2
        WHERE id = $1`); err != nil {
		return nil, fmt.Errorf("prepare update sketch: %w", err)
	}

	if s.DeleteSketch, err = prepare(`
        DELETE FROM sketches WHERE id = $1`); err != nil {
		return nil, fmt.Errorf("prepare delete sketch: %w", err)
	}

	return s, nil
}

func (s *Statements) CloseStatements() error {
	for _, stmt := range []*sql.Stmt{
		s.InsertUser,
		s.SelectUser,
		s.DeleteUser,
		s.UpsertUserStatus,
		s.SelectUserStatus,
		s.InsertChannel,
		s.SelectChannel,
		s.SelectChannels,
		s.SelectChannelMembers,
		s.AddChannelMember,
		s.InsertMessage,
		s.SelectMessages,
		s.SelectUserChannel,
		s.IsUserAdmin,
		s.InsertSketch,
		s.SelectSketchByID,
		s.SelectSketches,
		s.UpdateSketch,
		s.DeleteSketch,
	} {
		if stmt != nil {
			stmt.Close()
		}
	}
	return nil
}
