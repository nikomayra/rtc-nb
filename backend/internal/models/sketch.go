package models

import (
	"time"

	"github.com/google/uuid"
)

type Point struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type DrawPath struct {
	Points      []Point `json:"points"`
	IsDrawing   bool    `json:"is_drawing"`
	StrokeWidth int     `json:"stroke_width"`
	Color       string  `json:"color"`
}

type Region struct {
	Start Point      `json:"start"`
	End   Point      `json:"end"`
	Paths []DrawPath `json:"paths"`
}

type Sketch struct {
	ID          string            `json:"id"`
	ChannelName string            `json:"channel_name"`
	DisplayName string            `json:"display_name"`
	Width       int               `json:"width"`
	Height      int               `json:"height"`
	Regions     map[string]Region `json:"regions"` // key "x,y"
	CreatedAt   time.Time         `json:"created_at"`
	CreatedBy   string            `json:"created_by"`
}

func NewSketch(channelName, displayName string, width, height int, createdBy string) *Sketch {
	return &Sketch{
		ID:          uuid.New().String(),
		ChannelName: channelName,
		DisplayName: displayName,
		Width:       width,
		Height:      height,
		Regions:     make(map[string]Region),
		CreatedAt:   time.Now().UTC(),
		CreatedBy:   createdBy,
	}
}
