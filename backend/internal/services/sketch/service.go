package sketch

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"rtc-nb/backend/internal/auth"
	"rtc-nb/backend/internal/connections"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/internal/store/database"
	"time"
)

const MaxSketchesPerChannel = 8

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

	// Check if channel has reached sketch limit
	sketches, err := s.dbStore.GetSketches(ctx, channelName)
	if err != nil {
		return nil, fmt.Errorf("failed to check sketch count: %w", err)
	}

	if len(sketches) >= MaxSketchesPerChannel {
		return nil, fmt.Errorf("channel has reached the maximum limit of %d sketches", MaxSketchesPerChannel)
	}

	sketch := models.NewSketch(channelName, displayName, width, height, createdBy)
	if err := s.dbStore.CreateSketch(ctx, sketch); err != nil {
		return nil, fmt.Errorf("failed to create sketch: %w", err)
	}
	return sketch, nil
}

// GetSketch retrieves the full sketch details, including unmarshalled region paths.
// This performs a non-locking read.
func (s *Service) GetSketch(ctx context.Context, ID string) (*models.Sketch, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	sketch, err := s.dbStore.GetSketch(ctx, ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get sketch from store: %w", err)
	}
	if sketch == nil {
		return nil, nil // Not found
	}

	// The regions are already unmarshalled with paths by dbStore.GetSketch
	// No decompression is needed here.

	return sketch, nil
}

// Returns all sketches for a channel without the regions
func (s *Service) GetSketches(ctx context.Context, channelName string) ([]*models.Sketch, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	return s.dbStore.GetSketches(ctx, channelName)
}

/* COMMENTED OUT: Replaced by ApplySketchUpdates for atomic path merging
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
*/

// ApplySketchUpdates atomically fetches a sketch, appends paths from commands, and updates it.
func (s *Service) ApplySketchUpdates(ctx context.Context, sketchID string, commands []*models.SketchCommand) error {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second) // Increased timeout for Tx
	defer cancel()

	tx, err := s.dbStore.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction for apply updates: %w", err)
	}
	defer tx.Rollback() // Rollback is safe even if Commit succeeds

	// 1. Get sketch metadata and raw regions JSON, locking the row
	sketchMeta, regionsJSON, err := s.dbStore.GetSketchForUpdate(ctx, tx, sketchID)
	if err != nil {
		return fmt.Errorf("get sketch for update failed: %w", err)
	}
	if sketchMeta == nil {
		return fmt.Errorf("sketch %s not found during update", sketchID)
	}

	// 2. Unmarshal current regions
	currentRegions := make(map[string]models.Region)
	if len(regionsJSON) > 0 && string(regionsJSON) != "null" { // Handle empty/null JSON
		if err := json.Unmarshal(regionsJSON, &currentRegions); err != nil {
			return fmt.Errorf("failed to unmarshal current regions for sketch %s: %w", sketchID, err)
		}
	}

	// 3. Merge paths from commands
	for _, cmd := range commands {
		if cmd == nil || cmd.Region == nil {
			log.Printf("Skipping nil command or region for sketch %s", sketchID)
			continue
		}
		cmdRegion := cmd.Region
		key := fmt.Sprintf("%d,%d", cmdRegion.Start.X, cmdRegion.Start.Y)

		targetRegion, ok := currentRegions[key]
		if !ok {
			// If region doesn't exist in the map yet, create it.
			targetRegion = models.Region{
				Start: cmdRegion.Start,
				End:   cmdRegion.End,
				Paths: []models.DrawPath{},
			}
		} else {
			targetRegion.Start = cmdRegion.Start
			targetRegion.End = cmdRegion.End
		}

		// Append paths from the command to the target region
		if len(cmdRegion.Paths) > 0 {
			targetRegion.Paths = append(targetRegion.Paths, cmdRegion.Paths...)
			log.Printf("Appended %d paths to region %s for sketch %s", len(cmdRegion.Paths), key, sketchID)
		} else {
			log.Printf("Command for region %s sketch %s had no paths to append", key, sketchID)
		}

		currentRegions[key] = targetRegion
	}

	// 4. Assign merged regions back to the sketch metadata object
	sketchMeta.Regions = currentRegions

	// Log before attempting the database update
	// mergedRegionsJSON, _ := json.Marshal(currentRegions) // Marshal for logging, ignore error for simplicity here
	// log.Printf("ApplySketchUpdates(%s): Preparing to update DB. Merged regions JSON (length %d): %s", sketchID, len(mergedRegionsJSON), string(mergedRegionsJSON))

	// 5. Update the sketch in the database within the transaction
	if err := s.dbStore.UpdateSketchWithTx(ctx, tx, sketchMeta); err != nil {
		// Log includes sketchID and error already
		return fmt.Errorf("update sketch with tx failed for sketch %s: %w", sketchID, err)
	}

	// 6. Commit the transaction
	// log.Printf("ApplySketchUpdates(%s): Attempting to commit transaction...", sketchID)
	if err := tx.Commit(); err != nil {
		log.Printf("ERROR: ApplySketchUpdates(%s): Failed to commit transaction: %v", sketchID, err)
		return fmt.Errorf("commit transaction failed for sketch %s: %w", sketchID, err)
	}

	// log.Printf("ApplySketchUpdates(%s): Transaction committed successfully. Applied %d commands.", sketchID, len(commands))
	log.Printf("Successfully applied %d commands for sketch %s", len(commands), sketchID) // Revert to simpler success log
	return nil
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

	// Verify user is in the sketch's channel
	userChannel, err := s.connMgr.GetUserChannel(claims.Username)
	if err != nil || userChannel != sketch.ChannelName {
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

func (s *Service) ClearSketch(ctx context.Context, ID string) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	claims, ok := auth.ClaimsFromContext(ctx)
	if !ok {
		return fmt.Errorf("unauthorized")
	}

	sketch, err := s.dbStore.GetSketch(ctx, ID)
	if err != nil {
		return fmt.Errorf("failed to get sketch: %w", err)
	}

	// Verify user is in the sketch's channel
	userChannel, err := s.connMgr.GetUserChannel(claims.Username)
	if err != nil || userChannel != sketch.ChannelName {
		return fmt.Errorf("unauthorized")
	}

	// Clear the regions in the database
	if err := s.dbStore.ClearSketchRegions(ctx, ID); err != nil {
		return fmt.Errorf("failed to clear sketch regions: %w", err)
	}

	return nil
}
