// LOCAL STORAGE OPTION -- REPLACE WITH BACKBLAZE B2
package local

import (
	"context"
	"fmt"
	"image"
	"image/jpeg"
	"os"
	"path/filepath"

	"github.com/google/uuid"
	"golang.org/x/image/draw"
)

const (
	THUMBNAIL_WIDTH = 150
	STANDARD_WIDTH  = 1280
)

type LocalFileStore struct {
	basePath string
}

func NewLocalFileStore(basePath string) (*LocalFileStore, error) {
	// Create directories if they don't exist
	for _, dir := range []string{"images", "thumbnails"} {
		path := filepath.Join(basePath, dir)
		if err := os.MkdirAll(path, 0755); err != nil {
			return nil, fmt.Errorf("create directory %s: %w", path, err)
		}
	}

	return &LocalFileStore{basePath: basePath}, nil
}

// Returns the path to the original image and the path to the thumbnail
func (ls *LocalFileStore) SaveImage(ctx context.Context, img image.Image) (string, string, error) {
	// Generate unique filename
	filename := uuid.New().String() + ".jpg"

	// Save original
	imgPath := filepath.Join(ls.basePath, "images", filename)
	img, err := saveImage(img, imgPath)
	if err != nil {
		return "", "", fmt.Errorf("save original: %w", err)
	}

	// Generate and save thumbnail
	thumbPath := filepath.Join(ls.basePath, "thumbnails", filename)
	if err := saveThumbnail(img, thumbPath); err != nil {
		return "", "", fmt.Errorf("save thumbnail: %w", err)
	}

	return imgPath, thumbPath, nil
}

// Resizes the image to standard width, keep aspect ratio
func saveImage(img image.Image, path string) (image.Image, error) {
	// Create destination file
	dst, err := os.Create(path)
	if err != nil {
		return nil, err
	}
	defer dst.Close()

	// Calculate height maintaining aspect ratio
	bounds := img.Bounds()
	ratio := float64(bounds.Dx()) / float64(bounds.Dy())
	newHeight := int(float64(STANDARD_WIDTH) / ratio)

	// Resize image to standard width with calculated height
	dstImg := image.NewRGBA(image.Rect(0, 0, STANDARD_WIDTH, newHeight))
	draw.ApproxBiLinear.Scale(dstImg, dstImg.Rect, img, img.Bounds(), draw.Over, nil)

	// Save resized image
	if err := jpeg.Encode(dst, dstImg, nil); err != nil {
		return nil, err
	}

	return img, nil
}

func saveThumbnail(img image.Image, path string) error {
	// Create thumbnail file
	thumb, err := os.Create(path)
	if err != nil {
		return err
	}
	defer thumb.Close()

	// Calculate height maintaining aspect ratio
	bounds := img.Bounds()
	ratio := float64(bounds.Dx()) / float64(bounds.Dy())
	newHeight := int(float64(THUMBNAIL_WIDTH) / ratio)

	// Destination thumbnail image
	thumbnail := image.NewRGBA(image.Rect(0, 0, THUMBNAIL_WIDTH, newHeight))

	// Scale image to thumbnail size
	draw.ApproxBiLinear.Scale(thumbnail, thumbnail.Rect, img, img.Bounds(), draw.Over, nil)

	// Save thumbnail
	return jpeg.Encode(thumb, thumbnail, nil)
}
