package chat

import (
	"context"
	"fmt"
	"log"
	"rtc-nb/backend/internal/core"
	"sync"
	"time"
)

type ChatServer struct {
	state   core.StateManager
	persist core.PersistenceStrategy
	broker  core.MessageBroker

	// Configuration
	config ServerConfig

	// Batch processing
	batchMu   sync.Mutex
	batchChan chan core.Event

	// Graceful shutdown
	ctx    context.Context
	cancel context.CancelFunc
}

type ServerConfig struct {
	BatchSize     int
	BatchInterval time.Duration
	MessageTTL    time.Duration
	MaxChannels   int
	MaxMembership int
}

func NewChatServer(config ServerConfig, state core.StateManager, persist core.PersistenceStrategy, broker core.MessageBroker) *ChatServer {
	ctx, cancel := context.WithCancel(context.Background())

	server := &ChatServer{
		state:     state,
		persist:   persist,
		broker:    broker,
		config:    config,
		batchChan: make(chan core.Event, config.BatchSize*2),
		ctx:       ctx,
		cancel:    cancel,
	}

	// Start workers
	go server.batchWorker()
	go server.stateRecoveryWorker()

	return server
}

// HandleEvent is the main entry point for all operations
func (cs *ChatServer) HandleEvent(ctx context.Context, event core.Event) error {
	switch event.Type() {
	case "channel_create", "channel_delete", "user_register":
		return cs.handleTransactionalEvent(ctx, event)
	case "message_send":
		return cs.handleMessageEvent(event)
	default:
		return cs.handleStandardEvent(ctx, event)
	}
}

func (cs *ChatServer) handleTransactionalEvent(ctx context.Context, event core.Event) error {
	// Start transaction
	tx, err := cs.persist.BeginTransaction(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback() // Will be no-op if committed

	// 1. Persist to database
	if err := cs.persist.PersistTransactional(ctx, tx, event); err != nil {
		return fmt.Errorf("failed to persist event: %w", err)
	}

	// 2. Update in-memory state
	if err := cs.state.UpdateState(event); err != nil {
		return fmt.Errorf("failed to update state: %w", err)
	}

	// 3. Update Redis (if needed)
	switch event.Type() {
	case "channel_create":
		if err := cs.broker.Subscribe(event.Payload().(string)); err != nil {
			return fmt.Errorf("failed to subscribe to channel: %w", err)
		}
	case "channel_delete":
		if err := cs.broker.Unsubscribe(event.Payload().(string)); err != nil {
			return fmt.Errorf("failed to unsubscribe from channel: %w", err)
		}
	}

	// 4. Commit transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (cs *ChatServer) handleMessageEvent(event core.Event) error {
	// 1. Basic validation
	if err := cs.validateMessage(event); err != nil {
		return err
	}

	// 2. Queue for batch persistence
	cs.persist.QueueForBatch(event)

	// 3. Update in-memory state (if needed)
	if err := cs.state.UpdateState(event); err != nil {
		log.Printf("Warning: failed to update message state: %v", err)
		// Continue anyway - messages are ephemeral
	}

	// 4. Publish to Redis for real-time delivery
	return cs.broker.Publish(event.Channel(), event)
}

func (cs *ChatServer) batchWorker() {
	ticker := time.NewTicker(cs.config.BatchInterval)
	batch := make([]core.Event, 0, cs.config.BatchSize)

	for {
		select {
		case <-cs.ctx.Done():
			return
		case event := <-cs.batchChan:
			batch = append(batch, event)
			if len(batch) >= cs.config.BatchSize {
				cs.processBatch(batch)
				batch = batch[:0]
			}
		case <-ticker.C:
			if len(batch) > 0 {
				cs.processBatch(batch)
				batch = batch[:0]
			}
		}
	}
}

func (cs *ChatServer) processBatch(events []core.Event) {
	ctx, cancel := context.WithTimeout(cs.ctx, 5*time.Second)
	defer cancel()

	if err := cs.persist.PersistBatch(ctx, events); err != nil {
		log.Printf("Error persisting batch: %v", err)
		// Could implement retry logic here
	}
}

// Recovery and health check
func (cs *ChatServer) stateRecoveryWorker() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-cs.ctx.Done():
			return
		case <-ticker.C:
			if err := cs.reconcileState(); err != nil {
				log.Printf("Error reconciling state: %v", err)
			}
		}
	}
}

func (cs *ChatServer) reconcileState() error {
	ctx, cancel := context.WithTimeout(cs.ctx, 30*time.Second)
	defer cancel()

	// 1. Get database state
	dbState, err := cs.persist.GetCurrentState(ctx)
	if err != nil {
		return err
	}

	// 2. Compare with memory state and redis
	differences := cs.state.CompareWith(dbState)

	// 3. Reconcile differences
	for _, diff := range differences {
		if err := cs.handleStateDifference(ctx, diff); err != nil {
			log.Printf("Error handling state difference: %v", err)
		}
	}

	return nil
}
