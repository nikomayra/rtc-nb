package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Sketch struct {
	ID          string    `json:"id"`
	ChannelName string    `json:"channel_name"`
	DisplayName string    `json:"display_name"`
	Width       int       `json:"width"`
	Height      int       `json:"height"`
	Pixels      [][]bool  `json:"pixels"`
	CreatedAt   time.Time `json:"created_at"`
	CreatedBy   string    `json:"created_by"`
}

func NewSketch(channelName, displayName string, width, height int, createdBy string) *Sketch {
	pixels := make([][]bool, height)
	for i := range pixels {
		pixels[i] = make([]bool, width)
	}
	return &Sketch{
		ID:          uuid.New().String(),
		ChannelName: channelName,
		DisplayName: displayName,
		Width:       width,
		Height:      height,
		Pixels:      pixels,
		CreatedAt:   time.Now().UTC(),
		CreatedBy:   createdBy,
	}
}

func (s *Sketch) SetPixel(x, y int, value bool) error {
	if x < 0 || x >= s.Width || y < 0 || y >= s.Height {
		return fmt.Errorf("pixel out of bounds")
	}
	s.Pixels[y][x] = value
	return nil
}

func (s *Sketch) ToBytes() []byte {
	// Calculate bytes needed: (width * height + 7) / 8
	byteLength := (s.Width*s.Height + 7) / 8
	result := make([]byte, byteLength)

	bitIndex := 0
	for y := 0; y < s.Height; y++ {
		for x := 0; x < s.Width; x++ {
			if s.Pixels[y][x] {
				byteIndex := bitIndex / 8
				bitOffset := bitIndex % 8
				result[byteIndex] |= 1 << (7 - bitOffset)
			}
			bitIndex++
		}
	}
	return result
}

func (s *Sketch) FromBytes(data []byte) {
	s.Pixels = make([][]bool, s.Height)
	for i := range s.Pixels {
		s.Pixels[i] = make([]bool, s.Width)
	}

	bitIndex := 0
	for y := 0; y < s.Height; y++ {
		for x := 0; x < s.Width; x++ {
			byteIndex := bitIndex / 8
			bitOffset := bitIndex % 8
			s.Pixels[y][x] = (data[byteIndex] & (1 << (7 - bitOffset))) != 0
			bitIndex++
		}
	}
}
