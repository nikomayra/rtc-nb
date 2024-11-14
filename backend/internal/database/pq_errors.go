package database

import (
	"errors"

	"github.com/lib/pq"
)

// Common postgres error codes we care about
const (
	uniqueViolation     = "23505"
	foreignKeyViolation = "23503"
	stringTooLong       = "22001"
)

// Helper functions to check error types
func isPgError(err error) (*pq.Error, bool) {
	var pgErr *pq.Error
	if errors.As(err, &pgErr) {
		return pgErr, true
	}
	return nil, false
}

func isUniqueViolation(err error) bool {
	pgErr, ok := isPgError(err)
	return ok && pgErr.Code == uniqueViolation
}

func isForeignKeyViolation(err error) bool {
	pgErr, ok := isPgError(err)
	return ok && pgErr.Code == foreignKeyViolation
}

func isStringTooLong(err error) bool {
	pgErr, ok := isPgError(err)
	return ok && pgErr.Code == stringTooLong
}
