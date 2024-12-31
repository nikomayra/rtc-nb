package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"rtc-nb/backend/internal/auth"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/internal/services/chat"
	"rtc-nb/backend/internal/services/sketch"
	"rtc-nb/backend/pkg/api/responses"
	"rtc-nb/backend/pkg/utils"
	"strings"

	"github.com/gorilla/mux"
)

type Handlers struct {
	chatService   chat.ChatManager
	sketchService *sketch.Service
}

func NewHandlers(chatService chat.ChatManager, sketchService *sketch.Service) *Handlers {
	return &Handlers{
		chatService:   chatService,
		sketchService: sketchService,
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

func (h *Handlers) LogoutHandler(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		responses.SendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get WebSocket connection and disconnect if exists
	if conn, exists := h.chatService.GetUserConnection(claims.Username); exists {
		conn.Close()
	}

	// Clear any Redis data (if needed)
	ctx := r.Context()
	if err := h.chatService.ClearUserSession(ctx, claims.Username); err != nil {
		log.Printf("Error clearing user session: %v", err)
		// Continue anyway as this isn't critical
	}

	responses.SendSuccess(w, "Logged out successfully", http.StatusOK)
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
	vars := mux.Vars(r)
	channelName := vars["channelName"]
	log.Printf("Deleting channel: %s", channelName)
	if channelName == "" {
		responses.SendError(w, "Channel name required", http.StatusBadRequest)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		responses.SendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	if err := h.chatService.DeleteChannel(ctx, channelName, claims.Username); err != nil {
		log.Printf("Error deleting channel: %v", err)
		responses.SendError(w, "Failed to delete channel", http.StatusInternalServerError)
		return
	}

	responses.SendSuccess(w, fmt.Sprintf("Deleted channel: %s", channelName), http.StatusOK)
}

func (h *Handlers) LeaveChannelHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	channelName := vars["channelName"]
	if channelName == "" {
		responses.SendError(w, "Channel name required", http.StatusBadRequest)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		responses.SendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	if err := h.chatService.LeaveChannel(ctx, channelName, claims.Username); err != nil {
		log.Printf("Error leaving channel: %v", err)
		responses.SendError(w, "Failed to leave channel", http.StatusInternalServerError)
		return
	}

	responses.SendSuccess(w, fmt.Sprintf("Left channel: %s", channelName), http.StatusOK)
}

func (h *Handlers) UploadHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user from context
	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		responses.SendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Max upload size ~ 10MB
	const maxUploadSize = 10 << 20
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)

	// Parse multipart form with max memory
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		responses.SendError(w, "Request too large", http.StatusBadRequest)
		return
	}
	defer r.MultipartForm.RemoveAll()

	// Get file from form
	file, header, err := r.FormFile("file")
	if err != nil {
		responses.SendError(w, "Error retrieving file from form", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Get channel name from form
	channelName := r.FormValue("channelName")
	if channelName == "" {
		responses.SendError(w, "Channel name is required", http.StatusBadRequest)
		return
	}

	// Validate content type
	if err := utils.ValidateFile(header, file, maxUploadSize); err != nil {
		responses.SendError(w, fmt.Sprintf("Invalid file: %v", err), http.StatusBadRequest)
		return
	}

	// Process the upload based on content type
	var uploadResult interface{}
	var uploadErr error
	contentType := header.Header.Get("Content-Type")

	switch {
	case strings.HasPrefix(contentType, "image/"):
		uploadResult, uploadErr = h.chatService.HandleImageUpload(ctx, file, header, channelName, claims.Username)
	// Add cases for other file types as needed:
	case strings.HasPrefix(contentType, "video/"):
		uploadResult, uploadErr = h.chatService.HandleVideoUpload(ctx, file, header, channelName, claims.Username)
	case strings.HasPrefix(contentType, "audio/"):
		uploadResult, uploadErr = h.chatService.HandleAudioUpload(ctx, file, header, channelName, claims.Username)
	default:
		responses.SendError(w, "Unsupported content type", http.StatusBadRequest)
		return
	}

	if uploadErr != nil {
		log.Printf("Upload error: %v", uploadErr)
		responses.SendError(w, "Failed to process upload", http.StatusInternalServerError)
		return
	}

	responses.SendSuccess(w, uploadResult, http.StatusOK)
}

func (h *Handlers) DeleteAccountHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := auth.ClaimsFromContext(ctx)
	if !ok {
		responses.SendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if err := h.chatService.DeleteUser(ctx, claims.Username); err != nil {
		log.Printf("Error deleting user: %v", err)
		responses.SendError(w, "Failed to delete user", http.StatusInternalServerError)
		return
	}

	responses.SendSuccess(w, "User deleted successfully", http.StatusOK)
}

func (h *Handlers) CreateSketchHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ChannelName string `json:"channelName"`
		DisplayName string `json:"displayName"`
		Width       int    `json:"width"`
		Height      int    `json:"height"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		responses.SendError(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	claims, ok := auth.ClaimsFromContext(ctx)
	if !ok {
		responses.SendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if req.ChannelName == "" {
		responses.SendError(w, "Channel name required", http.StatusBadRequest)
		return
	}

	if err := h.sketchService.CreateSketch(ctx, req.ChannelName, req.DisplayName, req.Width, req.Height, claims.Username); err != nil {
		log.Printf("Error creating sketch: %v", err)
		responses.SendError(w, "Failed to create sketch", http.StatusInternalServerError)
		return
	}

	responses.SendSuccess(w, "Sketch created successfully", http.StatusCreated)
}

func (h *Handlers) GetSketchHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID          string `json:"id"`
		ChannelName string `json:"channelName"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		responses.SendError(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	claims, ok := auth.ClaimsFromContext(ctx)
	if !ok {
		responses.SendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if req.ChannelName == "" {
		responses.SendError(w, "Channel name required", http.StatusBadRequest)
		return
	}

	sketch, err := h.sketchService.GetSketch(ctx, req.ChannelName, claims.Username, req.ID)
	if err != nil {
		log.Printf("Error getting sketch: %v", err)
		responses.SendError(w, "Failed to get sketch", http.StatusInternalServerError)
		return
	}

	responses.SendSuccess(w, sketch, http.StatusOK)
}

func (h *Handlers) GetSketchesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	channelName := vars["channelName"]
	if channelName == "" {
		responses.SendError(w, "Channel name required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	claims, ok := auth.ClaimsFromContext(ctx)
	if !ok {
		responses.SendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	sketches, err := h.sketchService.GetSketches(ctx, channelName, claims.Username)
	if err != nil {
		log.Printf("Error getting sketches: %v", err)
		responses.SendError(w, "Failed to get sketches", http.StatusInternalServerError)
		return
	}

	responses.SendSuccess(w, sketches, http.StatusOK)
}

func (h *Handlers) DeleteSketchHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID          string `json:"id"`
		ChannelName string `json:"channelName"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		responses.SendError(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	claims, ok := auth.ClaimsFromContext(ctx)
	if !ok {
		responses.SendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if req.ChannelName == "" {
		responses.SendError(w, "Channel name required", http.StatusBadRequest)
		return
	}

	if err := h.sketchService.DeleteSketch(ctx, req.ID, req.ChannelName, claims.Username); err != nil {
		log.Printf("Error deleting sketch: %v", err)
		responses.SendError(w, "Failed to delete sketch", http.StatusInternalServerError)
		return
	}

	responses.SendSuccess(w, "Sketch deleted successfully", http.StatusOK)
}
