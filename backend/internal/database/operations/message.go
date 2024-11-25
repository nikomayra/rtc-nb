package operations

import (
	"context"
	"database/sql"
	"encoding/json"
	"rtc-nb/backend/internal/domain"
)

type MessageRepository struct {
	db *sql.DB
}

func (r *MessageRepository) SaveBatch(ctx context.Context, tx *sql.Tx, messages []*domain.Message) error {
	stmt := tx.StmtContext(ctx, statements.insertMessage)

	for _, msg := range messages {
		content, err := json.Marshal(msg.Content)
		if err != nil {
			return err
		}

		_, err = stmt.ExecContext(ctx,
			msg.ID,
			msg.ChannelName,
			msg.Username,
			int(msg.Type),
			content,
			msg.Timestamp,
		)
		if err != nil {
			return err
		}
	}

	return nil
}
