// Package storage defines interfaces for file storage
package storage

import (
	"context"
	"image"
)

type FileStorer interface {
	SaveImage(ctx context.Context, img image.Image) (string, string, error)
	// GetImage(ctx context.Context, filename string) (io.ReadCloser, error)
	// DeleteImage(ctx context.Context, filename string) error
}
