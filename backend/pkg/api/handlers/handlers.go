package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"rtc-nb/backend/internal/auth"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/internal/services/chat"
	"rtc-nb/backend/pkg/api/responses"
)

type Handlers struct {
	chatService *chat.ChatService
}

func NewHandlers(chatService *chat.ChatService) *Handlers {
	return &Handlers{
		chatService: chatService,
	}
}

func (h *Handlers) RegisterHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		responses.SendError(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	if req.Username == "" || req.Password == "" {
		responses.SendError(w, "Username and password are required", http.StatusBadRequest)
		return
	}

	// Check if user exists
	ctx := r.Context()
	storedUser, err := h.chatService.GetUser(ctx, req.Username)
	if err != nil {
		log.Printf("error checking user existence: %v", err)
		responses.SendError(w, "Error processing request", http.StatusInternalServerError)
		return
	}
	if storedUser != nil {
		responses.SendError(w, "Username already taken", http.StatusConflict)
		return
	}

	// Create new user
	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		log.Printf("error hashing password: %v", err)
		responses.SendError(w, "Error processing request", http.StatusInternalServerError)
		return
	}

	user, err := models.NewUser(req.Username, hashedPassword)
	if err != nil {
		log.Printf("error creating user: %v", err)
		responses.SendError(w, "Error processing request", http.StatusInternalServerError)
		return
	}

	if err := h.chatService.CreateUser(ctx, user); err != nil {
		log.Printf("error saving user: %v", err)
		responses.SendError(w, "Error processing request", http.StatusInternalServerError)
		return
	}

	// Generate JWT
	token, err := auth.GenerateAccessToken(req.Username)
	if err != nil {
		log.Printf("error generating token: %v", err)
		responses.SendError(w, "Error processing request", http.StatusInternalServerError)
		return
	}

	responses.SendSuccess(w, map[string]interface{}{
		"token":    token,
		"username": req.Username,
	}, http.StatusCreated)
}

func (h *Handlers) LoginHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	// Parse and validate request body
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		responses.SendError(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	if req.Username == "" || req.Password == "" {
		responses.SendError(w, "Username and password are required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	storedUser, err := h.chatService.GetUser(ctx, req.Username)
	if err != nil {
		log.Printf("Error fetching user: %v", err)
		responses.SendError(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}
	if storedUser == nil {
		responses.SendError(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Validate the provided password against the stored hash
	if err = auth.CheckPassword(storedUser.HashedPassword, req.Password); err != nil {
		responses.SendError(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Generate JWT for authenticated user
	token, err := auth.GenerateAccessToken(req.Username)
	if err != nil {
		log.Printf("Error generating token: %v", err)
		responses.SendError(w, "Error processing request", http.StatusInternalServerError)
		return
	}

	responses.SendSuccess(w, map[string]interface{}{
		"token":    token,
		"username": req.Username,
	}, http.StatusOK)
}

func (h *Handlers) JoinChannelHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ChannelName     string  `json:"channelName"`
		ChannelPassword *string `json:"channelPassword"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		responses.SendError(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	if req.ChannelName == "" {
		responses.SendError(w, "Channel name required", http.StatusBadRequest)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		responses.SendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	if err := h.chatService.JoinChannel(ctx, req.ChannelName, claims.Username, req.ChannelPassword); err != nil {
		log.Printf("Error joining channel: %v", err)
		responses.SendError(w, "Failed to join channel", http.StatusInternalServerError)
		return
	}

	responses.SendSuccess(w, fmt.Sprintf("Joined channel: %s", req.ChannelName), http.StatusOK)
}

func (h *Handlers) CreateChannelHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ChannelName        string  `json:"channelName"`
		ChannelDescription *string `json:"channelDescription"`
		ChannelPassword    *string `json:"channelPassword"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		responses.SendError(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	if req.ChannelName == "" {
		responses.SendError(w, "Channel name required", http.StatusBadRequest)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		responses.SendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var hashedPassword *string
	if req.ChannelPassword != nil && *req.ChannelPassword != "" {
		hashed, err := auth.HashPassword(*req.ChannelPassword)
		if err != nil {
			responses.SendError(w, "Error processing request", http.StatusInternalServerError)
			return
		}
		hashedPassword = &hashed
	}
	channel, err := models.NewChannel(req.ChannelName, claims.Username, req.ChannelDescription, hashedPassword)
	if err != nil {
		responses.SendError(w, fmt.Sprintf("Invalid channel data: %v", err), http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	if err := h.chatService.CreateChannel(ctx, channel); err != nil {
		log.Printf("Error creating channel: %v", err)
		responses.SendError(w, "Failed to create channel", http.StatusInternalServerError)
		return
	}

	responses.SendSuccess(w, channel, http.StatusCreated)
}

func (h *Handlers) GetChannelsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	channels, err := h.chatService.GetChannels(ctx)
	if err != nil {
		log.Printf("Error getting channels: %v", err)
		responses.SendError(w, "Failed to get channels", http.StatusInternalServerError)
		return
	}

	responses.SendSuccess(w, channels, http.StatusOK)
}

func (h *Handlers) DeleteChannelHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ChannelName string `json:"channelName"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		responses.SendError(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	if req.ChannelName == "" {
		responses.SendError(w, "Channel name required", http.StatusBadRequest)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		responses.SendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	if err := h.chatService.DeleteChannel(ctx, req.ChannelName, claims.Username); err != nil {
		log.Printf("Error deleting channel: %v", err)
		responses.SendError(w, "Failed to delete channel", http.StatusInternalServerError)
		return
	}

	responses.SendSuccess(w, fmt.Sprintf("Deleted channel: %s", req.ChannelName), http.StatusOK)
}

func (h *Handlers) LeaveChannelHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ChannelName string `json:"channelName"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		responses.SendError(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	if req.ChannelName == "" {
		responses.SendError(w, "Channel name required", http.StatusBadRequest)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		responses.SendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	if err := h.chatService.LeaveChannel(ctx, req.ChannelName, claims.Username); err != nil {
		log.Printf("Error leaving channel: %v", err)
		responses.SendError(w, "Failed to leave channel", http.StatusInternalServerError)
		return
	}

	responses.SendSuccess(w, fmt.Sprintf("Left channel: %s", req.ChannelName), http.StatusOK)
}
