// Package storage defines interfaces for file storage
package storage

import (
	"context"
	"io"
)

type FileStorer interface {
	SaveImage(ctx context.Context, file io.Reader) (string, string, error)
	// GetImage(ctx context.Context, filename string) (io.ReadCloser, error)
	// DeleteImage(ctx context.Context, filename string) error
}
