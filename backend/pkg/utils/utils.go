package utils

import (
	"fmt"
	"mime/multipart"
	"net/http"
	"strings"
)

func StringInSlice(s string, slice []string) bool {
	for _, item := range slice {
		if item == s {
			return true
		}
	}
	return false
}

func IsWebSocketRequest(r *http.Request) bool {
	return strings.EqualFold(r.Header.Get("Upgrade"), "websocket")
}

func IsAllowedContentType(contentType string) bool {
	allowedTypes := map[string]bool{
		// Images
		"image/jpeg": true,
		"image/png":  true,
		"image/bmp":  true,

		// Video
		"video/mp4":  true,
		"video/webm": true,

		// Audio
		"audio/mpeg": true,
		"audio/wav":  true,

		// Documents
		"application/pdf": true,
		"text/plain":      true,
	}

	return allowedTypes[contentType]
}

// Validate file size and content type
func ValidateFile(header *multipart.FileHeader, file multipart.File, maxFileSize int64) error {
	// Check file size
	if header.Size > maxFileSize {
		return fmt.Errorf("file too large: %d > %d", header.Size, maxFileSize)
	}

	// Read first 512 bytes for MIME type detection
	buff := make([]byte, 512)
	if _, err := file.Read(buff); err != nil {
		return fmt.Errorf("error reading file header: %w", err)
	}

	// Reset file pointer
	if _, err := file.Seek(0, 0); err != nil {
		return fmt.Errorf("error resetting file reader: %w", err)
	}

	// Get actual content type
	contentType := http.DetectContentType(buff)
	if !IsAllowedContentType(contentType) {
		return fmt.Errorf("invalid content type: %s", contentType)
	}

	return nil
}
