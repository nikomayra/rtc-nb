package chat

import (
	"context"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/internal/store/database"
	"sync"
	"time"
)

type userManager struct {
	mu sync.Mutex
	rw sync.RWMutex
	db *database.Store
}

func NewUserManager(db *database.Store) *userManager {
	return &userManager{
		db: db,
	}
}

func (um *userManager) GetUser(ctx context.Context, username string) (*models.User, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	um.rw.RLock()
	defer um.rw.RUnlock()
	return um.db.GetUser(ctx, username)
}

func (um *userManager) CreateUser(ctx context.Context, user *models.User) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	um.mu.Lock()
	defer um.mu.Unlock()
	return um.db.CreateUser(ctx, user)
}

func (um *userManager) DeleteUser(ctx context.Context, username string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	um.mu.Lock()
	defer um.mu.Unlock()
	return um.db.DeleteUser(ctx, username)
}
