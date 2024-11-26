package statements

import (
	"database/sql"
	"fmt"
)

// Statements holds all prepared SQL statements
type ChannelStatements struct {
	InsertChannel       *sql.Stmt // (name, is_private, hashed_password, description)
	SelectChannel       *sql.Stmt // (name)
	SelectChannels      *sql.Stmt //
	DeleteChannel       *sql.Stmt // (name)
	AddChannelMember    *sql.Stmt // (channel_name, username, is_admin)
	RemoveChannelMember *sql.Stmt // (channel_name, username)
}

var channelStatements ChannelStatements

// PrepareStatements initializes all SQL prepared statements
func PrepareChannelStatements(db *sql.DB) error {
	var err error

	// Channel statements
	channelStatements.InsertChannel, err = db.Prepare(`
        INSERT INTO channels (name, is_private, hashed_password, description)
        VALUES ($1, $2, $3, $4)
    `)
	if err != nil {
		return fmt.Errorf("prepare insert channel: %w", err)
	}
	channelStatements.SelectChannel, err = db.Prepare(`
        SELECT name, hashed_password, description
        FROM channels
        WHERE name = $1
    `)
	if err != nil {
		return fmt.Errorf("prepare select channel: %w", err)
	}

	channelStatements.SelectChannels, err = db.Prepare(`
        SELECT name, hashed_password, description
        FROM channels
    `)
	if err != nil {
		return fmt.Errorf("prepare select channels: %w", err)
	}

	channelStatements.DeleteChannel, err = db.Prepare(`
        DELETE FROM channels
        WHERE name = $1
    `)
	if err != nil {
		return fmt.Errorf("prepare delete channel: %w", err)
	}

	channelStatements.AddChannelMember, err = db.Prepare(`
        INSERT INTO channel_members (channel_name, username, is_admin)
        VALUES ($1, $2, $3)
    `)
	if err != nil {
		return fmt.Errorf("prepare add channel member: %w", err)
	}

	channelStatements.RemoveChannelMember, err = db.Prepare(`
        DELETE FROM channel_members
        WHERE channel_name = $1 AND username = $2
    `)
	if err != nil {
		return fmt.Errorf("prepare remove channel member: %w", err)
	}

	return nil
}

// CloseChannelStatements closes all prepared statements
func CloseChannelStatements() {
	statements := [...]*sql.Stmt{
		channelStatements.InsertChannel,
		channelStatements.SelectChannel,
		channelStatements.SelectChannels,
		channelStatements.DeleteChannel,
		channelStatements.AddChannelMember,
		channelStatements.RemoveChannelMember,
	}

	for _, stmt := range statements {
		if stmt != nil {
			stmt.Close()
		}
	}
}
