package operations

import (
	"context"
	"database/sql"
	"fmt"
	"rtc-nb/backend/internal/database"
	"rtc-nb/backend/internal/domain"
)

type ChannelRepository struct {
	statements *database.Statements
}

func NewChannelRepository(statements *database.Statements) *ChannelRepository {
	return &ChannelRepository{
		statements: statements,
	}
}

func (r *ChannelRepository) Create(ctx context.Context, tx *sql.Tx, channel *domain.Channel) error {
	// Use transaction if provided, otherwise use prepared statement directly
	stmt := tx.StmtContext(ctx, r.statements.InsertChannel)

	_, err := stmt.ExecContext(ctx,
		channel.Name,
		channel.IsPrivate,
		channel.HashedPassword,
		channel.Description,
	)
	if err != nil {
		return fmt.Errorf("create channel: %w", err)
	}

	// Add creator as admin
	memberStmt := tx.StmtContext(ctx, r.statements.AddChannelMember)
	_, err = memberStmt.ExecContext(ctx,
		channel.Name,
		channel.CreatedBy,
		true, // is_admin
	)
	return err
}
