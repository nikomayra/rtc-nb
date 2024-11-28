package repositories

import (
	"context"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/internal/store/database"
	"sync"
)

type Repository struct {
	store *database.Store
	mu    sync.Mutex
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

func (r *Repository) DeleteChannel(ctx context.Context, channelName string) error {
	return r.store.DeleteChannel(ctx, channelName)
}

func (r *Repository) UpdateChannel(ctx context.Context, channel *models.Channel) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.store.UpdateChannel(ctx, channel)
}

func (r *Repository) AddChannelMember(ctx context.Context, channelName string, member *models.ChannelMember) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.store.AddChannelMember(ctx, channelName, member)
}

func (r *Repository) RemoveChannelMember(ctx context.Context, channelName string, username string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.store.RemoveChannelMember(ctx, channelName, username)
}

func (r *Repository) IsUserAdmin(ctx context.Context, channelName string, username string) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.store.IsUserAdmin(ctx, channelName, username)
}
