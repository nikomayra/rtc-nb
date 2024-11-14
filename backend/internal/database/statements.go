package database

import (
	"database/sql"
	"fmt"
)

// Statements holds all prepared SQL statements
type Statements struct {
	insertUser       *sql.Stmt
	selectUser       *sql.Stmt
	insertChannel    *sql.Stmt
	selectChannel    *sql.Stmt
	addChannelMember *sql.Stmt
	insertMessage    *sql.Stmt
	selectMessages   *sql.Stmt
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
        INSERT INTO channels (name, password_hash, description)
        VALUES ($1, $2, $3)
    `)
	if err != nil {
		return fmt.Errorf("prepare insert channel: %w", err)
	}

	statements.addChannelMember, err = db.Prepare(`
        INSERT INTO channel_members (channel_name, username, is_admin)
        VALUES ($1, $2, $3)
    `)
	if err != nil {
		return fmt.Errorf("prepare add channel member: %w", err)
	}

	// Message statements
	statements.insertMessage, err = db.Prepare(`
        INSERT INTO messages (id, channel_name, username, message_type, content)
        VALUES ($1, $2, $3, $4, $5)
    `)
	if err != nil {
		return fmt.Errorf("prepare insert message: %w", err)
	}

	statements.selectMessages, err = db.Prepare(`
        SELECT id, username, message_type, content, timestamp
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
		statements.addChannelMember,
		statements.insertMessage,
		statements.selectMessages,
	}

	for _, stmt := range statements {
		if stmt != nil {
			stmt.Close()
		}
	}
}
