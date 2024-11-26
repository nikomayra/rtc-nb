package statements

import (
	"database/sql"
	"fmt"
)

// Statements holds all prepared SQL statements
type UserStatements struct {
	InsertUser *sql.Stmt // (username, password_hash)
	SelectUser *sql.Stmt // (username)
	UpdateUser *sql.Stmt // (password_hash)
	DeleteUser *sql.Stmt // (username)
}

func PrepareUserStatements(db *sql.DB) (*UserStatements, error) {
	statements := &UserStatements{}
	var err error

	statements.InsertUser, err = db.Prepare(`
        INSERT INTO users (username, password_hash) 
        VALUES ($1, $2)
    `)
	if err != nil {
		return nil, fmt.Errorf("prepare insert user: %w", err)
	}

	statements.SelectUser, err = db.Prepare(`
        SELECT username, password_hash 
        FROM users 
        WHERE username = $1
    `)
	if err != nil {
		return nil, fmt.Errorf("prepare select user: %w", err)
	}

	statements.UpdateUser, err = db.Prepare(`
        UPDATE users 
        SET password_hash = $2
        WHERE username = $1
    `)
	if err != nil {
		return nil, fmt.Errorf("prepare update user: %w", err)
	}

	statements.DeleteUser, err = db.Prepare(`
        DELETE FROM users 
        WHERE username = $1
    `)
	if err != nil {
		return nil, fmt.Errorf("prepare delete user: %w", err)
	}

	return statements, nil
}

func (s *UserStatements) CloseStatements() error {
	statements := [...]*sql.Stmt{
		s.InsertUser,
		s.SelectUser,
		s.UpdateUser,
		s.DeleteUser,
	}

	for _, stmt := range statements {
		if stmt != nil {
			if err := stmt.Close(); err != nil {
				return err
			}
		}
	}
	return nil
}
