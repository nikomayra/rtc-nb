package database

import (
	"database/sql"
	"fmt"
	"os"

	"rtc-nb/backend/internal/store/database/operations"
	"rtc-nb/backend/internal/store/database/statements"

	_ "github.com/lib/pq"
)

type Store struct {
	db              *sql.DB
	UsersOperations *operations.UserOperations
}

func NewStore() *Store {
	return &Store{}
}

func (p *Store) Open() error {
	var err error
	p.db, err = sql.Open("postgres", os.Getenv("POSTGRES_CONNECTION_STRING"))
	if err != nil {
		return fmt.Errorf("error opening database: %w", err)
	}

	if err := p.db.Ping(); err != nil {
		return fmt.Errorf("error connecting to database: %w", err)
	}

	// Initialize operations & statements
	if err := p.initOperations(); err != nil {
		return fmt.Errorf("failed to initialize operations: %w", err)
	}

	return nil
}

func (p *Store) Close() error {
	if p.UsersOperations != nil {
		if err := p.UsersOperations.Close(); err != nil {
			return fmt.Errorf("error closing user operations: %w", err)
		}
	}
	return p.db.Close()
}

func (p *Store) initOperations() error {
	userStatements, err := statements.PrepareUserStatements(p.db)
	if err != nil {
		return err
	}
	p.UsersOperations = operations.NewUserOperations(userStatements)
	return nil
}
