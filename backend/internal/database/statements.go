package database

import (
	"database/sql"
	"fmt"
)

// Statements holds all prepared SQL statements
type Statements struct {
	insertUser          *sql.Stmt // (username, password_hash)
	selectUser          *sql.Stmt // (username)
	insertChannel       *sql.Stmt // (name, is_private, hashed_password, description)
	selectChannel       *sql.Stmt // (name)
	selectChannels      *sql.Stmt //
	deleteChannel       *sql.Stmt // (name)
	addChannelMember    *sql.Stmt // (channel_name, username, is_admin)
	removeChannelMember *sql.Stmt // (channel_name, username)
	insertMessage       *sql.Stmt // (id, channel_name, username, message_type, content, timestamp)
	selectMessages      *sql.Stmt // (channel_name, limit)
}

var statements Statements

// PrepareStatements initializes all SQL prepared statements
func PrepareStatements(db *sql.DB) error {
	var err error

	// User statements
	statements.insertUser, err = db.Prepare(`
        INSERT INTO users (username, password_hash) 
        VALUES ($1, $2)
    `)
	if err != nil {
		return fmt.Errorf("prepare insert user: %w", err)
	}

	statements.selectUser, err = db.Prepare(`
        SELECT username, password_hash 
        FROM users 
        WHERE username = $1
    `)
	if err != nil {
		return fmt.Errorf("prepare select user: %w", err)
	}

	// Channel statements
	statements.insertChannel, err = db.Prepare(`
        INSERT INTO channels (name, is_private, hashed_password, description)
        VALUES ($1, $2, $3, $4)
    `)
	if err != nil {
		return fmt.Errorf("prepare insert channel: %w", err)
	}
	statements.selectChannel, err = db.Prepare(`
        SELECT name, hashed_password, description
        FROM channels
        WHERE name = $1
    `)
	if err != nil {
		return fmt.Errorf("prepare select channel: %w", err)
	}

	statements.selectChannels, err = db.Prepare(`
        SELECT name, hashed_password, description
        FROM channels
    `)
	if err != nil {
		return fmt.Errorf("prepare select channels: %w", err)
	}

	statements.deleteChannel, err = db.Prepare(`
        DELETE FROM channels
        WHERE name = $1
    `)
	if err != nil {
		return fmt.Errorf("prepare delete channel: %w", err)
	}

	statements.addChannelMember, err = db.Prepare(`
        INSERT INTO channel_members (channel_name, username, is_admin)
        VALUES ($1, $2, $3)
    `)
	if err != nil {
		return fmt.Errorf("prepare add channel member: %w", err)
	}

	statements.removeChannelMember, err = db.Prepare(`
        DELETE FROM channel_members
        WHERE channel_name = $1 AND username = $2
    `)
	if err != nil {
		return fmt.Errorf("prepare remove channel member: %w", err)
	}

	// Message statements
	statements.insertMessage, err = db.Prepare(`
        INSERT INTO messages (id, channel_name, username, message_type, content, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6)
    `)
	if err != nil {
		return fmt.Errorf("prepare insert message: %w", err)
	}

	statements.selectMessages, err = db.Prepare(`
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
		statements.insertUser,
		statements.selectUser,
		statements.insertChannel,
		statements.selectChannel,
		statements.selectChannels,
		statements.deleteChannel,
		statements.addChannelMember,
		statements.removeChannelMember,
		statements.insertMessage,
		statements.selectMessages,
	}

	for _, stmt := range statements {
		if stmt != nil {
			stmt.Close()
		}
	}
}
