package database

import (
	"database/sql"
	"fmt"
)

// Statements holds all prepared SQL statements
type Statements struct {
	InsertUser          *sql.Stmt // (username, password_hash)
	SelectUser          *sql.Stmt // (username)
	InsertChannel       *sql.Stmt // (name, is_private, hashed_password, description)
	SelectChannel       *sql.Stmt // (name)
	SelectChannels      *sql.Stmt //
	DeleteChannel       *sql.Stmt // (name)
	AddChannelMember    *sql.Stmt // (channel_name, username, is_admin)
	RemoveChannelMember *sql.Stmt // (channel_name, username)
	InsertMessage       *sql.Stmt // (id, channel_name, username, message_type, content, timestamp)
	SelectMessages      *sql.Stmt // (channel_name, limit)
}

var statements Statements

// PrepareStatements initializes all SQL prepared statements
func PrepareStatements(db *sql.DB) error {
	var err error

	// User statements
	statements.InsertUser, err = db.Prepare(`
        INSERT INTO users (username, password_hash) 
        VALUES ($1, $2)
    `)
	if err != nil {
		return fmt.Errorf("prepare insert user: %w", err)
	}

	statements.SelectUser, err = db.Prepare(`
        SELECT username, password_hash 
        FROM users 
        WHERE username = $1
    `)
	if err != nil {
		return fmt.Errorf("prepare select user: %w", err)
	}

	// Channel statements
	statements.InsertChannel, err = db.Prepare(`
        INSERT INTO channels (name, is_private, hashed_password, description)
        VALUES ($1, $2, $3, $4)
    `)
	if err != nil {
		return fmt.Errorf("prepare insert channel: %w", err)
	}
	statements.SelectChannel, err = db.Prepare(`
        SELECT name, hashed_password, description
        FROM channels
        WHERE name = $1
    `)
	if err != nil {
		return fmt.Errorf("prepare select channel: %w", err)
	}

	statements.SelectChannels, err = db.Prepare(`
        SELECT name, hashed_password, description
        FROM channels
    `)
	if err != nil {
		return fmt.Errorf("prepare select channels: %w", err)
	}

	statements.DeleteChannel, err = db.Prepare(`
        DELETE FROM channels
        WHERE name = $1
    `)
	if err != nil {
		return fmt.Errorf("prepare delete channel: %w", err)
	}

	statements.AddChannelMember, err = db.Prepare(`
        INSERT INTO channel_members (channel_name, username, is_admin)
        VALUES ($1, $2, $3)
    `)
	if err != nil {
		return fmt.Errorf("prepare add channel member: %w", err)
	}

	statements.RemoveChannelMember, err = db.Prepare(`
        DELETE FROM channel_members
        WHERE channel_name = $1 AND username = $2
    `)
	if err != nil {
		return fmt.Errorf("prepare remove channel member: %w", err)
	}

	// Message statements
	statements.InsertMessage, err = db.Prepare(`
        INSERT INTO messages (id, channel_name, username, message_type, content, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6)
    `)
	if err != nil {
		return fmt.Errorf("prepare insert message: %w", err)
	}

	statements.SelectMessages, err = db.Prepare(`
        SELECT id, channel_name, username, message_type, content, timestamp
        FROM messages
        WHERE channel_name = $1
        ORDER BY timestamp DESC
        LIMIT $2
    `)
	if err != nil {
		return fmt.Errorf("prepare select messages: %w", err)
	}

	return nil
}

// CloseStatements closes all prepared statements
func CloseStatements() {
	statements := [...]*sql.Stmt{
		statements.InsertUser,
		statements.SelectUser,
		statements.InsertChannel,
		statements.SelectChannel,
		statements.SelectChannels,
		statements.DeleteChannel,
		statements.AddChannelMember,
		statements.RemoveChannelMember,
		statements.InsertMessage,
		statements.SelectMessages,
	}

	for _, stmt := range statements {
		if stmt != nil {
			stmt.Close()
		}
	}
}
