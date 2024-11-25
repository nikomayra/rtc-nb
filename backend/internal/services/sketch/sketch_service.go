package sketch

import "context"

// SketchService defines the interface for collaborative sketch features.
type SketchService interface {
	StartNewSketch(ctx context.Context, sketch Sketch) (Sketch, error)
	UpdateSketch(ctx context.Context, sketchID string, delta SketchDelta) (Sketch, error)
}

// Sketch represents a collaborative drawing session.
type Sketch struct {
	ID        string `json:"id"`
	UserID    string `json:"user_id"`
	Data      string `json:"data"` // serialized sketch data (e.g., SVG, canvas data)
	CreatedAt string `json:"created_at"`
}

// SketchDelta represents a change in the sketch.
type SketchDelta struct {
	Action      string `json:"action"` // e.g., "draw", "erase"
	Coordinates string `json:"coords"` // Coordinates of drawing action
}
