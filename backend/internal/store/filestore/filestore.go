// LOCAL STORAGE OPTION -- REPLACE WITH BACKBLAZE B2
package filestore

import (
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"os"
	"path/filepath"

	"github.com/google/uuid"
	// "github.com/nfnt/resize" -- TODO: Create resizing logic in-house
)

type FileStore struct {
	basePath string
}

func NewFileStore(basePath string) (*FileStore, error) {
	// Create directories if they don't exist
	for _, dir := range []string{"images", "thumbnails"} {
		path := filepath.Join(basePath, dir)
		if err := os.MkdirAll(path, 0755); err != nil {
			return nil, fmt.Errorf("create directory %s: %w", path, err)
		}
	}

	return &FileStore{basePath: basePath}, nil
}

func (fs *FileStore) SaveImage(file io.Reader) (string, string, error) {
	// Generate unique filename
	filename := uuid.New().String() + ".jpg"

	// Save original
	imgPath := filepath.Join(fs.basePath, "images", filename)
	img, err := saveImage(file, imgPath)
	if err != nil {
		return "", "", fmt.Errorf("save original: %w", err)
	}

	// Generate and save thumbnail
	thumbPath := filepath.Join(fs.basePath, "thumbnails", filename)
	if err := saveThumbnail(img, thumbPath); err != nil {
		return "", "", fmt.Errorf("save thumbnail: %w", err)
	}

	return filename, filename, nil
}

func saveImage(file io.Reader, path string) (image.Image, error) {
	// Create destination file
	dst, err := os.Create(path)
	if err != nil {
		return nil, err
	}
	defer dst.Close()

	// Decode image
	img, _, err := image.Decode(file)
	if err != nil {
		return nil, err
	}

	// Save original
	if err := jpeg.Encode(dst, img, nil); err != nil {
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

	// Resize to thumbnail size (e.g., 150x150)
	thumbnail := resize.Thumbnail(150, 150, img, resize.Lanczos3)

	// Save thumbnail
	return jpeg.Encode(thumb, thumbnail, nil)
}
