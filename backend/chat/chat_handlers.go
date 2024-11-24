package chat

import (
	"fmt"
	"log"
	"rtc-nb/backend/internal/auth"
	"rtc-nb/backend/internal/database"
	"rtc-nb/backend/internal/events"
	"rtc-nb/backend/internal/models"
)

func (cs *ChatServer) eventWorker() {

}

func (cs *ChatServer) handleEvent(event events.ChannelEvent) {

}

func (cs *ChatServer) CreateChannel(name, creatorUsername string, description, password *string) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	if _, exists := cs.channels[name]; exists {
		return fmt.Errorf("channel %s already exists ", name)
	}

	var hashedPassword *string
	if password != nil {
		hashed, err := auth.HashPassword(*password)
		if err != nil {
			return fmt.Errorf("failed to hash password: %w", err)
		}
		hashedPassword = &hashed
	}

	channel, err := models.NewChannel(name, creatorUsername, description, hashedPassword)
	if err != nil {
		return fmt.Errorf("error creating channel: %w", err)
	}

	if err := database.CreateChannel(channel, creatorUsername); err != nil {
		return fmt.Errorf("error creating channel in database: %w", err)
	}

	subChannel, err := cs.redisClient.Subscribe(channel.Name)
	if err != nil {
		return fmt.Errorf("error subscribing to redis channel %s: %v", channel.Name, err)
	}

	go cs.handleRedisSubscription(subChannel)

	cs.channels[name] = channel

	log.Printf("Created channel %s", name)
	return nil
}

func (cs *ChatServer) JoinChannel(username, channelName string, password *string) error {
	cs.mu.RLock()
	channel, exists := cs.channels[channelName]
	cs.mu.RUnlock()

	if !exists {
		return fmt.Errorf("channel %s does not exist", channelName)
	}

	if password != nil && !channel.ValidatePassword(*password) {
		return fmt.Errorf("invalid channel password")
	}

	isAdmin := channel.IsAdmin(username)

	if err := channel.AddMember(username, isAdmin); err != nil {
		return fmt.Errorf("error adding member to channel: %w", err)
	}

	if err := database.AddUserToChannel(channelName, username, isAdmin); err != nil {
		channel.RemoveMember(username)
		return fmt.Errorf("error adding member to channel in database: %w", err)
	}

	log.Printf("User: %s, joined channel %s.\n", username, channelName)

	return nil
}

func (cs *ChatServer) LeaveChannel(username, channelName string) error {
	cs.mu.RLock()
	channel, exists := cs.channels[channelName]
	cs.mu.RUnlock()

	if !exists {
		return fmt.Errorf("channel %s does not exist", channelName)
	}

	if err := channel.RemoveMember(username); err != nil {
		return fmt.Errorf("failed to remove member: %w", err)
	}

	if err := database.RemoveUserFromChannel(channelName, username); err != nil {
		log.Printf("Failed to remove user from database: %v", err)
	}

	return nil
}

func (cs *ChatServer) DeleteChannel(channelName, username string) error {
	cs.mu.RLock()
	channel, exists := cs.channels[channelName]
	cs.mu.RUnlock()

	if !exists {
		return fmt.Errorf("channel %s does not exist ", channelName)
	}

	if !channel.IsAdmin(username) {
		return fmt.Errorf("Only admins can delete channels")
	}

	for username := range channel.GetMembers() {
		if err := channel.RemoveMember(username); err != nil {
			return fmt.Errorf("error removing user: %s, from channel: %w", username, err)
		}
	}

	if err := database.DeleteChannel(channelName); err != nil {
		return fmt.Errorf("error deleting channel: %w", err)
	}

	if err := cs.redisClient.UnSubscribe(channelName); err != nil {
		return fmt.Errorf("error unsubscribing to Redis channel %s: %v", channelName, err)
	}

	delete(cs.channels, channelName)

	log.Printf("Deleted channel %s\n", channelName)
	return nil
}
