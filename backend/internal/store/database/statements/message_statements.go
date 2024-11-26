package statements

import (
	"database/sql"
	"fmt"
)

// Statements holds all prepared SQL statements
type MessageStatements struct {
	InsertMessage  *sql.Stmt // (id, channel_name, username, message_type, content, timestamp)
	SelectMessages *sql.Stmt // (channel_name, limit)
}

var messageStatements MessageStatements

// PrepareStatements initializes all SQL prepared statements
func PrepareMessageStatements(db *sql.DB) error {
	var err error

	// Message statements
	messageStatements.InsertMessage, err = db.Prepare(`
        INSERT INTO messages (id, channel_name, username, message_type, content, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6)
    `)
	if err != nil {
		return fmt.Errorf("prepare insert message: %w", err)
	}

	messageStatements.SelectMessages, err = db.Prepare(`
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

// CloseMessageStatements closes all prepared statements
func CloseMessageStatements() {
	statements := [...]*sql.Stmt{
		messageStatements.InsertMessage,
		messageStatements.SelectMessages,
	}

	for _, stmt := range statements {
		if stmt != nil {
			stmt.Close()
		}
	}
}
