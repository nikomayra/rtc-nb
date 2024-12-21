package chat

import (
	"context"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"mime/multipart"

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

	// Check image-specific size limit
	// TODO: Maybe we don't care since we resize before savings anyways...?
	// if header.Size > maxImageSize {
	// 	return nil, fmt.Errorf("image too large: %d > %d bytes", header.Size, maxImageSize)
	// }

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

func (am *attachmentManager) HandleVideoUpload(ctx context.Context, file multipart.File, header *multipart.FileHeader, channelName, username string) (interface{}, error) {
	return nil, nil
}

func (am *attachmentManager) HandleAudioUpload(ctx context.Context, file multipart.File, header *multipart.FileHeader, channelName, username string) (interface{}, error) {
	return nil, nil
}
