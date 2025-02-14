package chat

import (
	"context"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"mime/multipart"
	"time"

	"rtc-nb/backend/internal/store/database"
	"rtc-nb/backend/internal/store/storage"
)

type attachmentManager struct {
	// mu         sync.RWMutex
	db         *database.Store
	fileStorer storage.FileStorer
}

func NewAttachmentManager(db *database.Store, fileStorer storage.FileStorer) *attachmentManager {
	return &attachmentManager{
		db:         db,
		fileStorer: fileStorer,
	}
}

func (am *attachmentManager) HandleImageUpload(ctx context.Context, file multipart.File, header *multipart.FileHeader, channelName, username string) (interface{}, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// Validate image format
	img, _, err := image.Decode(file)
	if err != nil {
		return nil, fmt.Errorf("invalid image format: %w", err)
	}

	// Reset file pointer
	if _, err := file.Seek(0, 0); err != nil {
		return nil, fmt.Errorf("error resetting file: %w", err)
	}

	imgPath, thumbPath, err := am.fileStorer.SaveImage(ctx, img)
	if err != nil {
		return nil, fmt.Errorf("save image: %w", err)
	}
	return map[string]string{"imagePath": imgPath, "thumbnailPath": thumbPath}, nil
}
