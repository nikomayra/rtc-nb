package sketch

import (
	"context"
	"fmt"
	"log"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/internal/store/database"
	"time"
)

// TODO: More sophisticated error & context handling
type SketchService struct {
	dbStore *database.Store
}

func NewSketchService(dbStore *database.Store) *SketchService {
	return &SketchService{dbStore: dbStore}
}

func (s *SketchService) CreateSketch(ctx context.Context, channelName, displayName string, width, height int, createdBy string) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	sketch := models.NewSketch(channelName, displayName, width, height, createdBy)
	return s.dbStore.CreateSketch(ctx, sketch)
}

func (s *SketchService) GetSketch(ctx context.Context, channelName, username, ID string) (*models.Sketch, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// Validate channel membership
	userChannel, err := s.dbStore.GetUserChannel(ctx, username)
	if err != nil {
		return nil, err
	}

	if userChannel != channelName {
		return nil, fmt.Errorf("not a member of this channel")
	}

	return s.dbStore.GetSketch(ctx, ID)
}

// Returns all sketches for a channel without the pixels
func (s *SketchService) GetSketches(ctx context.Context, channelName, username string) ([]*models.Sketch, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	log.Printf("username: %s, channelName: %s", username, channelName)
	// Validate channel membership
	userChannel, err := s.dbStore.GetUserChannel(ctx, username)
	if err != nil {
		return nil, err
	}
	log.Printf("userChannel: %s, channelName: %s", userChannel, channelName)
	if userChannel != channelName {
		return nil, fmt.Errorf("not a member of this channel")
	}

	return s.dbStore.GetSketches(ctx, channelName)
}

// func (s *SketchService) UpdateSketch(ctx context.Context, sketch *models.Sketch) error {
// 	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
// 	defer cancel()
// 	return s.dbStore.UpdateSketch(ctx, sketch)
// }

func (s *SketchService) DeleteSketch(ctx context.Context, ID, channelName, username string) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// First get the sketch
	sketch, err := s.dbStore.GetSketch(ctx, ID)
	if err != nil {
		return fmt.Errorf("failed to get sketch: %w", err)
	}

	// Check if user is the creator
	if sketch.CreatedBy == username {
		return s.dbStore.DeleteSketch(ctx, ID)
	}

	// If not creator, check if user is channel admin
	isAdmin, err := s.dbStore.IsUserAdmin(ctx, channelName, username)
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
