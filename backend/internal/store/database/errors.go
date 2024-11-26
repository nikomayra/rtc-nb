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
func IsPgError(err error) (*pq.Error, bool) {
	var pgErr *pq.Error
	if errors.As(err, &pgErr) {
		return pgErr, true
	}
	return nil, false
}

func IsUniqueViolation(err error) bool {
	pgErr, ok := IsPgError(err)
	return ok && pgErr.Code == uniqueViolation
}

func IsForeignKeyViolation(err error) bool {
	pgErr, ok := IsPgError(err)
	return ok && pgErr.Code == foreignKeyViolation
}

func IsStringTooLong(err error) bool {
	pgErr, ok := IsPgError(err)
	return ok && pgErr.Code == stringTooLong
}
