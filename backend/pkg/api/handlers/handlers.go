package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"rtc-nb/backend/internal/auth"
	"rtc-nb/backend/internal/connections"
	"rtc-nb/backend/internal/messaging"
	"rtc-nb/backend/internal/models"
	"rtc-nb/backend/internal/services/chat"
	"rtc-nb/backend/internal/services/sketch"
	"rtc-nb/backend/pkg/api/responses"
	"rtc-nb/backend/pkg/utils"
	"strings"

	"github.com/gorilla/mux"
)

type Handlers struct {
	connMgr       connections.Manager
	chatService   chat.ChatManager
	sketchService *sketch.Service
	msgProcessor  *messaging.Processor
}

func NewHandlers(connMgr connections.Manager, chatService chat.ChatManager, sketchService *sketch.Service, msgProcessor *messaging.Processor) *Handlers {
	return &Handlers{
		connMgr:       connMgr,
		chatService:   chatService,
		sketchService: sketchService,
		msgProcessor:  msgProcessor,
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

	if strings.ToLower(req.Username) == "system" {
		responses.SendError(w, "Username cannot be 'system'", http.StatusBadRequest)
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

func (h *Handlers) ValidateTokenHandler(w http.ResponseWriter, r *http.Request) {

	_, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		responses.SendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	responses.SendSuccess(w, "Validated Login", http.StatusOK)
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
		ChannelPassword *string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		responses.SendError(w, "Invalid request format", http.StatusBadRequest)
		return
	}

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

	// Call the service method, capturing the wasAdded flag
	wasAdded, err := h.chatService.JoinChannel(ctx, channelName, claims.Username, req.ChannelPassword)
	if err != nil {
		log.Printf("Error joining channel: %v", err)
		// Determine appropriate error code based on the error type
		statusCode := http.StatusInternalServerError
		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "invalid password") {
			statusCode = http.StatusUnauthorized // Or StatusNotFound / StatusBadRequest depending on context
		}
		responses.SendError(w, fmt.Sprintf("Failed to join channel: %v", err), statusCode)
		return
	}

	// Only broadcast MemberUpdate if the user was newly added to the channel members
	if wasAdded {
		// Broadcast MemberUpdate channel message for the new member
		memberUpdateMsg := models.NewMemberUpdateMessage(channelName, claims.Username, claims.Username, "added", false) // Actor and Target are the same, new members are not admin
		if broadcastErr := h.msgProcessor.ProcessMessage(memberUpdateMsg); broadcastErr != nil {
			log.Printf("Error broadcasting member added update for %s in channel %s: %v", claims.Username, channelName, broadcastErr)
			// Log error but continue, join operation itself was successful
		}
	}

	// Return success
	responses.SendSuccess(w, fmt.Sprintf("Joined channel: %s", channelName), http.StatusOK)
}

func (h *Handlers) CreateChannelHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ChannelDescription *string `json:"description"`
		ChannelPassword    *string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		responses.SendError(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	vars := mux.Vars(r)
	channelName := vars["channelName"]
	if channelName == "" {
		responses.SendError(w, "Channel name required", http.StatusBadRequest)
		return
	} else if strings.ToLower(channelName) == "system" {
		responses.SendError(w, "'system' is a reserved channel name", http.StatusBadRequest)
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
	channel, err := models.NewChannel(channelName, claims.Username, req.ChannelDescription, hashedPassword)
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

	// Broadcast ChannelUpdate system message
	channelUpdateMsg := models.NewChannelUpdateMessage("created", channel)
	if err := h.msgProcessor.ProcessMessage(channelUpdateMsg); err != nil {
		log.Printf("Error broadcasting channel create update for %s: %v", channelName, err)
		// Log error but continue, channel creation was successful
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
	// log.Printf("Deleting channel: %s", channelName)
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
	// Retrieve channel details before deleting for broadcasting
	channel, err := h.chatService.GetChannel(ctx, channelName)
	if err != nil {
		log.Printf("Error retrieving channel for deletion %s: %v", channelName, err)
		// Decide how to handle - maybe channel already deleted? Still try to delete.
	}

	if err := h.chatService.DeleteChannel(ctx, channelName, claims.Username); err != nil {
		log.Printf("Error deleting channel: %v", err)
		responses.SendError(w, "Failed to delete channel", http.StatusInternalServerError)
		return
	}

	// Broadcast ChannelUpdate system message
	if channel != nil { // Only broadcast if we could retrieve channel info
		channelUpdateMsg := models.NewChannelUpdateMessage("deleted", channel)
		if err := h.msgProcessor.ProcessMessage(channelUpdateMsg); err != nil {
			log.Printf("Error broadcasting channel delete update for %s: %v", channelName, err)
			// Log error but continue, channel deletion was successful
		}
	}

	// Force disconnect clients from the deleted channel's WS pool
	h.connMgr.RemoveAllClientsFromChannel(channelName)

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

	// Return success with online users data
	responses.SendSuccess(w, fmt.Sprintf("Left channel: %s", channelName), http.StatusOK)
}

func (h *Handlers) UploadHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// log.Printf("Upload request received: Content-Type: %s, Content-Length: %d",
	// 	r.Header.Get("Content-Type"),
	// 	r.ContentLength)

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

	// log.Printf("Form parsed successfully. File headers: %+v", r.MultipartForm.File)

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
		ChannelName string `json:"channel_name"`
		DisplayName string `json:"display_name"`
		Width       int    `json:"width"`
		Height      int    `json:"height"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		responses.SendError(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	if req.ChannelName == "" || req.DisplayName == "" || req.Width <= 0 || req.Height <= 0 {
		responses.SendError(w, "Channel name, display name, width, and height are required", http.StatusBadRequest)
		return
	}

	// Limit sketch dimensions? e.g., max 5000x5000
	maxDim := 5000
	if req.Width > maxDim || req.Height > maxDim {
		responses.SendError(w, fmt.Sprintf("Sketch dimensions cannot exceed %d pixels", maxDim), http.StatusBadRequest)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		responses.SendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()

	// TODO: Implement permission check: h.chatService.IsUserMemberOfChannel(ctx, req.ChannelName, claims.Username)
	// isMember, err := h.chatService.IsUserMemberOfChannel(ctx, req.ChannelName, claims.Username)
	// if err != nil {
	// 	log.Printf("Error checking channel membership: %v", err)
	// 	responses.SendError(w, "Error checking permissions", http.StatusInternalServerError)
	// 	return
	// }
	// if !isMember {
	// 	responses.SendError(w, "Forbidden: User is not a member of this channel", http.StatusForbidden)
	// 	return
	// }

	// TODO: Implement sketch limit check: h.sketchService.GetSketchesByChannel(ctx, req.ChannelName)
	// sketches, err := h.sketchService.GetSketchesByChannel(ctx, req.ChannelName)
	// if err != nil {
	// 	log.Printf("Error getting sketches count: %v", err)
	// 	responses.SendError(w, "Error checking sketch limit", http.StatusInternalServerError)
	// 	return
	// }
	// sketchLimit := 10 // Make configurable
	// if len(sketches) >= sketchLimit {
	// 	responses.SendError(w, fmt.Sprintf("Channel sketch limit reached (%d)", sketchLimit), http.StatusConflict)
	// 	return
	// }

	// Call sketch service to create the sketch
	// The service should return the created sketch object
	createdSketch, err := h.sketchService.CreateSketch(ctx, req.ChannelName, req.DisplayName, req.Width, req.Height, claims.Username)
	if err != nil {
		log.Printf("Error creating sketch in service: %v", err)
		responses.SendError(w, "Error creating sketch", http.StatusInternalServerError)
		return
	}

	// Broadcast NEW sketch command via WebSocket
	broadcastCmd := models.SketchCommand{
		CommandType: models.SketchCommandTypeNew,
		SketchID:    createdSketch.ID,
		SketchData:  createdSketch, // Include full sketch data from the service response
	}
	// Assuming NewSketchBroadcastMessage exists in models package
	broadcastMsg := models.NewSketchBroadcastMessage(req.ChannelName, claims.Username, broadcastCmd)
	if broadcastErr := h.msgProcessor.ProcessMessage(broadcastMsg); broadcastErr != nil {
		log.Printf("Error broadcasting new sketch message for sketch %s in channel %s: %v", createdSketch.ID, req.ChannelName, broadcastErr)
		// Log error but don't fail the API response, creation was successful
	}

	responses.SendSuccess(w, createdSketch, http.StatusCreated)
}

func (h *Handlers) GetSketchHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	claims, ok := auth.ClaimsFromContext(ctx)
	if !ok {
		responses.SendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	channelName := vars["channelName"]
	sketchId := vars["sketchId"]

	// Validate channel membership
	userChannel, err := h.connMgr.GetUserChannel(claims.Username)
	if err != nil {
		responses.SendError(w, "Unauthorized: Could not verify user channel connection", http.StatusUnauthorized)
		return
	}

	if userChannel != channelName {
		responses.SendError(w, "Not a member of this channel", http.StatusUnauthorized)
		return
	}

	sketch, err := h.sketchService.GetSketch(ctx, sketchId)
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

	// Validate channel membership
	userChannel, err := h.connMgr.GetUserChannel(claims.Username)
	if err != nil {
		responses.SendError(w, "Unauthorized: Could not verify user channel connection", http.StatusUnauthorized)
		return
	}

	if userChannel != channelName {
		responses.SendError(w, "Not a member of this channel", http.StatusUnauthorized)
		return
	}

	sketches, err := h.sketchService.GetSketches(ctx, channelName)
	if err != nil {
		log.Printf("Error getting sketches: %v", err)
		responses.SendError(w, "Failed to get sketches", http.StatusInternalServerError)
		return
	}

	responses.SendSuccess(w, sketches, http.StatusOK)
}

func (h *Handlers) DeleteSketchHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sketchId := vars["sketchId"]
	if sketchId == "" {
		responses.SendError(w, "Sketch ID required", http.StatusBadRequest)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		responses.SendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()

	// Get sketch data first to check ownership/permissions and get channel name
	sketch, err := h.sketchService.GetSketch(ctx, sketchId)
	if err != nil {
		log.Printf("Error fetching sketch %s for deletion check: %v", sketchId, err)
		// Differentiate between not found and other errors
		if strings.Contains(err.Error(), "not found") { // Or use specific error type if available
			responses.SendError(w, "Sketch not found", http.StatusNotFound)
		} else {
			responses.SendError(w, "Error finding sketch", http.StatusInternalServerError)
		}
		return
	}

	// Proceed with deletion
	err = h.sketchService.DeleteSketch(ctx, sketchId)
	if err != nil {
		log.Printf("Error deleting sketch: %v", err)
		responses.SendError(w, "Error deleting sketch", http.StatusInternalServerError)
		return
	}

	// Broadcast DELETE sketch command via WebSocket
	broadcastCmd := models.SketchCommand{
		CommandType: models.SketchCommandTypeDelete,
		SketchID:    sketchId,
	}
	// Use the sketch's channel name for broadcasting
	// Assuming NewSketchBroadcastMessage exists in models package
	broadcastMsg := models.NewSketchBroadcastMessage(sketch.ChannelName, claims.Username, broadcastCmd)
	if broadcastErr := h.msgProcessor.ProcessMessage(broadcastMsg); broadcastErr != nil {
		log.Printf("Error broadcasting delete sketch message for sketch %s in channel %s: %v", sketchId, sketch.ChannelName, broadcastErr)
		// Log error but don't fail the API response, deletion was successful
	}

	responses.SendSuccess(w, "Success", http.StatusOK)
}

func (h *Handlers) ClearSketchHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ChannelName string `json:"channel_name"`
		SketchId    string `json:"sketch_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		responses.SendError(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	if req.ChannelName == "" || req.SketchId == "" {
		responses.SendError(w, "Channel name and sketch ID are required", http.StatusBadRequest)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		responses.SendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()

	// Call the service to clear the sketch (e.g., remove all regions)
	err := h.sketchService.ClearSketch(ctx, req.SketchId)
	if err != nil {
		log.Printf("Error clearing sketch %s: %v", req.SketchId, err)
		if strings.Contains(err.Error(), "not found") { // Or use specific error type
			responses.SendError(w, "Sketch not found", http.StatusNotFound)
		} else {
			responses.SendError(w, "Error clearing sketch", http.StatusInternalServerError)
		}
		return
	}

	// Broadcast CLEAR sketch command via WebSocket
	broadcastCmd := models.SketchCommand{
		CommandType: models.SketchCommandTypeClear,
		SketchID:    req.SketchId,
	}
	// Assuming NewSketchBroadcastMessage exists in models package
	broadcastMsg := models.NewSketchBroadcastMessage(req.ChannelName, claims.Username, broadcastCmd)
	if broadcastErr := h.msgProcessor.ProcessMessage(broadcastMsg); broadcastErr != nil {
		log.Printf("Error broadcasting clear sketch message for sketch %s in channel %s: %v", req.SketchId, req.ChannelName, broadcastErr)
		// Log error but don't fail the API response, clear operation was successful
	}

	responses.SendSuccess(w, "Success", http.StatusOK)
}

func (h *Handlers) GetMessagesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	channelName := vars["channelName"]
	if channelName == "" {
		responses.SendError(w, "Channel name required", http.StatusBadRequest)
		return
	}

	messages, err := h.chatService.GetMessages(r.Context(), channelName)
	if err != nil {
		log.Printf("Error getting messages: %v", err)
		responses.SendError(w, "Failed to get messages", http.StatusInternalServerError)
		return
	}

	responses.SendSuccess(w, messages, http.StatusOK)
}

func (h *Handlers) UpdateChannelMemberRole(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	channelName := vars["channelName"]
	username := vars["username"]

	var req struct {
		IsAdmin bool `json:"is_admin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		responses.SendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		responses.SendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	if err := h.chatService.UpdateMemberRole(ctx, channelName, username, req.IsAdmin, claims.Username); err != nil {
		responses.SendError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Broadcast MemberUpdate channel message
	memberUpdateMsg := models.NewMemberUpdateMessage(channelName, claims.Username, username, "role_changed", req.IsAdmin)
	if err := h.msgProcessor.ProcessMessage(memberUpdateMsg); err != nil {
		log.Printf("Error broadcasting member role update for %s in channel %s: %v", username, channelName, err)
		// Log error but continue, role update was successful
	}

	responses.SendSuccess(w, "Success", http.StatusOK)
}

func (h *Handlers) GetAllOnlineUsersHandler(w http.ResponseWriter, r *http.Request) {

	_, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		responses.SendError(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	onlineUsers := h.connMgr.GetCountOfAllOnlineUsers()

	responses.SendSuccess(w, onlineUsers, http.StatusOK)
}

func (h *Handlers) GetOnlineUsersInChannelHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	channelName := vars["channelName"]
	if channelName == "" {
		responses.SendError(w, "Channel name required", http.StatusBadRequest)
		return
	}

	onlineUsers := h.connMgr.GetOnlineUsersInChannel(channelName)
	responses.SendSuccess(w, onlineUsers, http.StatusOK)
}

func (h *Handlers) GetChannelMembersHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	channelName := vars["channelName"]
	if channelName == "" {
		responses.SendError(w, "Channel name required", http.StatusBadRequest)
		return
	}

	members, err := h.chatService.GetChannelMembers(r.Context(), channelName)
	if err != nil {
		responses.SendError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	responses.SendSuccess(w, members, http.StatusOK)
}
