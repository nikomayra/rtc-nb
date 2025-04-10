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
}

type Region struct {
	Start Point      `json:"start"`
	End   Point      `json:"end"`
	Paths []DrawPath `json:"paths"`
	// Pixels     [][]bool   `json:"-"` // Used for rendering (COMMENTED OUT: Not used for persistence, rendering handled by frontend)
	// Compressed []byte     `json:"-"` // For storage (COMMENTED OUT: Compression logic was not correctly persisted)
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

/* COMMENTED OUT: This function overwrites region paths instead of merging/appending.
// It's unsuitable for processing updates from the buffer.
// The rasterization/compression logic within was also not persisted correctly.
func (s *Sketch) AddRegion(region Region) error {
	// Validate region bounds
	if region.Start.X < 0 || region.Start.Y < 0 ||
		region.End.X >= s.Width || region.End.Y >= s.Height {
		return fmt.Errorf("region bounds outside sketch dimensions")
	}

	// Rasterize paths to pixels
	pixels := make([][]bool, region.End.Y-region.Start.Y+1)
	for i := range pixels {
		pixels[i] = make([]bool, region.End.X-region.Start.X+1)
	}

	// Rasterize each stroke
	for _, stroke := range region.Paths {
		rasterizeStroke(pixels, stroke, region.Start)
	}

	// Compress for storage
	region.Compressed = compressRegion(pixels)

	// Store region
	key := fmt.Sprintf("%d,%d", region.Start.X, region.Start.Y)
	s.Regions[key] = region

	key := fmt.Sprintf("%d,%d", region.Start.X, region.Start.Y)
	s.Regions[key] = region                                                                     // Keep this line for now for potential other uses, but buffer shouldn't call AddRegion for updates.
	fmt.Println("WARNING: Sketch.AddRegion called - this might be incorrect for update logic.") // Add warning if it's somehow still called

	return nil
}
*/

/* COMMENTED OUT: Rasterization logic - Not used for persistence
func rasterizeStroke(pixels [][]bool, stroke DrawPath, offset Point) {
	for i := 1; i < len(stroke.Points); i++ {
		p1 := stroke.Points[i-1]
		p2 := stroke.Points[i]

		// Draw circle at the end of the previous segment (acts as join/intermediate cap)
		if stroke.StrokeWidth > 1 {
			// Re-drawing p1's circle ensures joins are covered, though slightly redundant
			drawCircle(pixels, p1, stroke.StrokeWidth/2, stroke.IsDrawing, offset)
			drawCircle(pixels, p2, stroke.StrokeWidth/2, stroke.IsDrawing, offset)
		}

		// Connect points with line algorithm
		drawLine(pixels, p1, p2, stroke.StrokeWidth, stroke.IsDrawing, offset)
	}
}
*/

/* COMMENTED OUT: Rasterization logic - Not used for persistence
// Filled circle using midpoint circle algorithm with scanline fill
func drawCircle(pixels [][]bool, center Point, radius int, isDrawing bool, offset Point) {
	// Adjust for region offset
	cx := center.X - offset.X
	cy := center.Y - offset.Y

	// Draw filled circle using horizontal scanlines
	for y := -radius; y <= radius; y++ {
		for x := -radius; x <= radius; x++ {
			// If point is inside circle
			if x*x+y*y <= radius*radius {
				px := cx + x
				py := cy + y

				// Check bounds
				if px >= 0 && px < len(pixels[0]) &&
					py >= 0 && py < len(pixels) {
					pixels[py][px] = isDrawing
				}
			}
		}
	}
}
*/

/* COMMENTED OUT: Rasterization logic - Not used for persistence
func drawLine(pixels [][]bool, p1, p2 Point, width int, isDrawing bool, offset Point) {
	if width <= 1 {
		drawSingleLine(pixels, p1, p2, isDrawing, offset)
		return
	}

	// For thick lines, draw parallel lines
	halfWidth := width / 2
	dx := float64(p2.X - p1.X)
	dy := float64(p2.Y - p1.Y)
	length := math.Sqrt(dx*dx + dy*dy)

	if length < 0.0001 {
		return
	}

	// Draw multiple parallel lines
	for i := -halfWidth; i <= halfWidth; i++ {
		shift := float64(i) / length
		shiftX := int(-dy * shift)
		shiftY := int(dx * shift)

		start := Point{
			X: p1.X + shiftX,
			Y: p1.Y + shiftY,
		}
		end := Point{
			X: p2.X + shiftX,
			Y: p2.Y + shiftY,
		}

		drawSingleLine(pixels, start, end, isDrawing, offset)
	}
}
*/

/* COMMENTED OUT: Rasterization logic - Not used for persistence
// Bresenham's line algorithm
func drawSingleLine(pixels [][]bool, p1, p2 Point, isDrawing bool, offset Point) {

	x1, y1 := p1.X-offset.X, p1.Y-offset.Y
	x2, y2 := p2.X-offset.X, p2.Y-offset.Y
	dx := math.Abs(float64(x2 - x1))
	dy := math.Abs(float64(y2 - y1))

	var sx, sy int
	if x1 < x2 {
		sx = 1
	} else {
		sx = -1
	}
	if y1 < y2 {
		sy = 1
	} else {
		sy = -1
	}
	err := dx - dy

	for {
		if x1 >= 0 && x1 < len(pixels[0]) && y1 >= 0 && y1 < len(pixels) {
			pixels[y1][x1] = isDrawing
		}
		if x1 == x2 && y1 == y2 {
			break
		}
		e2 := 2 * err
		if e2 > -dy {
			err -= dy
			x1 += sx
		}
		if e2 < dx {
			err += dx
			y1 += sy
		}
	}
}
*/

/* COMMENTED OUT: Compression logic - Not used for persistence
// Example of how RLE compression works for a region:
// Input pixels:
// [true,  true,  true,  false, false]
// [false, false, true,  true,  false]
//
// Compressed output:
// [3, 2, 2, 3]  // 3 trues, 2 falses, 2 trues, 3 falses
func compressRegion(pixels [][]bool) []byte {
	var result []byte
	count := byte(0)
	current := false

	for _, row := range pixels {
		for _, pixel := range row {
			if pixel == current && count < 255 {
				count++
			} else {
				result = append(result, count)
				current = !current // Toggle between true/false
				count = 1
			}
		}
	}
	if count > 0 {
		result = append(result, count)
	}
	return result
}
*/

/* COMMENTED OUT: Decompression logic - Not used for persistence
func (s *Sketch) DecompressRegion(data []byte, width, height int) [][]bool {
	pixels := make([][]bool, height)
	for i := range pixels {
		pixels[i] = make([]bool, width)
	}

	x, y := 0, 0
	current := false

	for _, count := range data {
		for i := byte(0); i < count; i++ {
			pixels[y][x] = current
			x++
			if x >= width {
				x = 0
				y++
			}
		}
		current = !current
	}
	return pixels
}
*/
