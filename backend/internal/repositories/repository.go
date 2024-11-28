package repositories

import (
	"context"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/internal/store/database"
)

type Repository struct {
	store *database.Store
}

func NewRepository(store *database.Store) *Repository {
	return &Repository{store: store}
}

func (r *Repository) CreateUser(ctx context.Context, user *models.User) error {
	return r.store.CreateUser(ctx, user)
}

func (r *Repository) GetUser(ctx context.Context, username string) (*models.User, error) {
	return r.store.GetUser(ctx, username)
}

func (r *Repository) CreateChannel(ctx context.Context, channel *models.Channel) error {
	return r.store.CreateChannel(ctx, channel)
}

func (r *Repository) GetChannel(ctx context.Context, channelName string) (*models.Channel, error) {
	return r.store.GetChannel(ctx, channelName)
}

func (r *Repository) GetChannels(ctx context.Context) ([]*models.Channel, error) {
	return r.store.GetChannels(ctx)
}
