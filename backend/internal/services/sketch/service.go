package sketch

import (
	"context"
	"fmt"
	"rtc-nb/backend/internal/auth"
	"rtc-nb/backend/internal/connections"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/internal/store/database"
	"time"
)

// TODO: More sophisticated error & context handling
type Service struct {
	dbStore *database.Store
	connMgr connections.Manager
}

func NewService(dbStore *database.Store, connMgr connections.Manager) *Service {
	return &Service{dbStore: dbStore, connMgr: connMgr}
}

func (s *Service) CreateSketch(ctx context.Context, channelName, displayName string, width, height int, createdBy string) (*models.Sketch, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	sketch := models.NewSketch(channelName, displayName, width, height, createdBy)
	if err := s.dbStore.CreateSketch(ctx, sketch); err != nil {
		return nil, fmt.Errorf("failed to create sketch: %w", err)
	}
	return sketch, nil
}

func (s *Service) GetSketch(ctx context.Context, ID string) (*models.Sketch, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	sketch, err := s.dbStore.GetSketch(ctx, ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get sketch: %w", err)
	}

	// Convert regions to pixels & decompress
	for key, region := range sketch.Regions {
		width := region.End.X - region.Start.X + 1
		height := region.End.Y - region.Start.Y + 1
		region.Pixels = sketch.DecompressRegion(region.Compressed, width, height)
		sketch.Regions[key] = region
	}

	return sketch, nil
}

// Returns all sketches for a channel without the regions
func (s *Service) GetSketches(ctx context.Context, channelName string) ([]*models.Sketch, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	return s.dbStore.GetSketches(ctx, channelName)
}

func (s *Service) UpdateSketch(ctx context.Context, sketch *models.Sketch) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	tx, err := s.dbStore.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.dbStore.UpdateSketchWithTx(ctx, tx, sketch); err != nil {
		return fmt.Errorf("update sketch: %w", err)
	}

	return tx.Commit()
}

func (s *Service) DeleteSketch(ctx context.Context, ID string) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// First get the sketch
	sketch, err := s.dbStore.GetSketch(ctx, ID)
	if err != nil {
		return fmt.Errorf("failed to get sketch: %w", err)
	}

	claims, ok := auth.ClaimsFromContext(ctx)
	if !ok {
		return fmt.Errorf("unauthorized")
	}

	// Check if user is the creator
	if sketch.CreatedBy == claims.Username {
		return s.dbStore.DeleteSketch(ctx, ID)
	}

	// If not creator, check if user is channel admin
	isAdmin, err := s.dbStore.IsUserAdmin(ctx, sketch.ChannelName, claims.Username)
	if err != nil {
		return fmt.Errorf("failed to check admin status: %w", err)
	}

	if isAdmin {
		return s.dbStore.DeleteSketch(ctx, ID)
	}

	return fmt.Errorf("unauthorized: only sketch creator or channel admin can delete sketches")
}

// func (s *SketchService) SaveSketch(ctx context.Context, sketch *models.Sketch) error {
// 	return nil
// }
