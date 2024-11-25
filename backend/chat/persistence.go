package chat

import (
	"context"
	"database/sql"
	"fmt"
	"rtc-nb/backend/internal/core"
	"rtc-nb/backend/internal/database"
)

type PostgresPersistence struct {
	db         *sql.DB
	batchSize  int
	batchQueue chan core.Event
	statements *database.Statements
}

func NewPostgresPersistence(db *sql.DB, batchSize int) (*PostgresPersistence, error) {
	p := &PostgresPersistence{
		db:         db,
		batchSize:  batchSize,
		batchQueue: make(chan core.Event, batchSize*2),
	}

	return p, nil
}

// PersistTransactional handles immediate persistence needs with transaction support
func (p *PostgresPersistence) PersistTransactional(ctx context.Context, tx *sql.Tx, event core.Event) error {
	switch evt := event.(type) {
	case *ChannelCreateEvent:
		return p.persistChannelCreate(ctx, tx, evt)
	case *ChannelDeleteEvent:
		return p.persistChannelDelete(ctx, tx, evt)
	default:
		return fmt.Errorf("unsupported transactional event type: %T", event)
	}
}

func (p *PostgresPersistence) persistChannelCreate(ctx context.Context, tx *sql.Tx, evt *ChannelCreateEvent) error {
	// Use the existing CreateChannel logic but with transaction
	_, err := tx.StmtContext(ctx, p.statements.insertChannel).Exec(
		evt.Channel.Name,
		evt.Channel.IsPrivate,
		evt.Channel.HashedPassword,
		evt.Channel.Description,
	)
	if err != nil {
		return fmt.Errorf("failed to create channel: %w", err)
	}

	// Add creator as admin
	_, err = tx.StmtContext(ctx, p.statements.addChannelMember).Exec(
		evt.Channel.Name,
		evt.CreatorUsername,
		true, // is_admin
	)
	return err
}

// QueueForBatch handles events that can be batched (like messages)
func (p *PostgresPersistence) QueueForBatch(event core.Event) error {
	select {
	case p.batchQueue <- event:
		return nil
	default:
		return fmt.Errorf("batch queue full")
	}
}

// processBatch handles a batch of events
func (p *PostgresPersistence) processBatch(ctx context.Context, events []core.Event) error {
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin batch transaction: %w", err)
	}
	defer tx.Rollback()

	stmt := tx.StmtContext(ctx, p.statements.insertMessage)
	for _, event := range events {
		if msg, ok := event.(*MessageEvent); ok {
			if err := p.persistMessage(ctx, stmt, msg); err != nil {
				return err
			}
		}
	}

	return tx.Commit()
}

func (p *PostgresPersistence) persistMessage(ctx context.Context, stmt *sql.Stmt, msg *MessageEvent) error {
	_, err := stmt.ExecContext(ctx,
		msg.ID,
		msg.ChannelName,
		msg.Username,
		msg.Type,
		msg.Content,
		msg.Timestamp,
	)
	return err
}
