package events

import (
	"context"
	"database/sql"
	"fmt"
	"rtc-nb/backend/internal/database/tx"
)

// EventHandler defines the interface for event handlers
type EventHandler interface {
	Handle(context.Context, Event) error
}

// ChannelEventHandler handles channel-related events
type ChannelEventHandler struct {
	txManager *tx.TxManager
	state     StateManager
	broker    MessageBroker
}

func (h *ChannelEventHandler) Handle(ctx context.Context, evt Event) error {
	channelEvt, ok := evt.(*ChannelEvent)
	if !ok {
		return fmt.Errorf("invalid event type: expected ChannelEvent")
	}

	return h.txManager.WithinTx(ctx, func(tx *sql.Tx) error {
		// First persist to database
		if err := h.persistChannelEvent(ctx, tx, channelEvt); err != nil {
			return err
		}

		// Then update state and broker
		if err := h.state.UpdateState(channelEvt); err != nil {
			return err
		}

		return h.broker.PublishEvent(channelEvt)
	})
}
