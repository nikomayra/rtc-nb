package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"rtc-nb/backend/api/responses"
	"rtc-nb/backend/chat"
	"rtc-nb/backend/internal/auth"
	"rtc-nb/backend/internal/database"
	"rtc-nb/backend/internal/models"
)

type Handlers struct {
	chatServer *chat.ChatServer
}

func NewHandlers(chatServer *chat.ChatServer) *Handlers {
	return &Handlers{
		chatServer: chatServer,
	}
}

func (h *Handlers) RegisterHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	// Parse and validate request body
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("failed to decode request: %v", err)
		responses.SendError(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	// Basic validation
	if req.Username == "" || req.Password == "" {
		responses.SendError(w, "Username and password are required", http.StatusBadRequest)
		return
	}

	// Check DB to see if username already is taken
	storedUser, err := database.GetUser(req.Username)
	if err == nil && storedUser != nil {
		responses.SendError(w, "Username already taken", http.StatusConflict)
		return
	}

	// Hash password
	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		log.Printf("error hashing password for user %s: %v", req.Username, err)
		responses.SendError(w, "Error processing request", http.StatusInternalServerError)
		return
	}

	// Generate JWT token
	token, err := auth.CreateToken(req.Username)
	if err != nil {
		log.Printf("error generating token for user %s: %v", req.Username, err)
		responses.SendError(w, "Error processing request", http.StatusInternalServerError)
		return
	}

	// Create new user
	user := models.NewUser(req.Username, hashedPassword)

	// Add new user to database
	if err := database.AddUser(user); err != nil {
		log.Printf("error adding new user %s to database: %v", req.Username, err)
		responses.SendError(w, "Failed to add new user", http.StatusInternalServerError)
		return
	}

	// Success response
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

	// Retrieve user from DB
	storedUser, err := database.GetUser(req.Username)
	if err != nil {
		log.Printf("Error fetching user by username: %v", err)
		responses.SendError(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Validate the provided password against the stored hash
	if err = auth.CheckPassword(storedUser.HashedPassword, req.Password); err != nil {
		responses.SendError(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Generate JWT for authenticated user
	token, err := auth.CreateToken(req.Username)
	if err != nil {
		log.Printf("Error generating token: %v", err)
		responses.SendError(w, "Error generating token", http.StatusInternalServerError)
		return
	}

	// Send success response with JWT
	responses.SendSuccess(w, map[string]interface{}{
		"token":    token,
		"username": req.Username,
	}, http.StatusOK)
}

func (h *Handlers) JoinChannelHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		//Username        string  `json:"username"`
		ChannelName     string  `json:"channelName"`
		ChannelPassword *string `json:"channelPassword"` //optional
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		responses.SendError(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	if req.ChannelName == "" {
		responses.SendError(w, "channel name required", http.StatusBadRequest)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		log.Println("ERROR: No claims found in context")
		return
	}

	err := h.chatServer.JoinChannel(claims.Username, req.ChannelName, req.ChannelPassword)
	if err != nil {
		responses.SendError(w, fmt.Sprintf("Failed to join channel: %v", err), http.StatusInternalServerError)
		return
	}
	isAdmin := h.chatServer.IsUserAdmin(req.ChannelName, claims.Username)
	if err := database.AddUserToChannel(req.ChannelName, claims.Username, isAdmin); err != nil {
		log.Printf("error adding user %s to channel %s in database: %v", claims.Username, req.ChannelName, err)
		responses.SendError(w, "Failed to add user to channel in database", http.StatusInternalServerError)
		return
	}
	responses.SendSuccess(w, fmt.Sprintf("Joined Channel: %s", req.ChannelName), http.StatusOK)
}

// TODO: maybe I should make them send Username in the request body so I can validate username/token combination..?
func (h *Handlers) CreateChannelHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		// Username           string  `json:"username"`
		ChannelName        string  `json:"channelName"`
		ChannelDescription *string `json:"channelDescription"`
		ChannelPassword    *string `json:"channelPassword"` //optional
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		responses.SendError(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	if req.ChannelName == "" {
		responses.SendError(w, "channel name required", http.StatusBadRequest)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		log.Println("ERROR: No claims found in context")
		return
	}

	channel, err := h.chatServer.CreateChannel(req.ChannelName, claims.Username, req.ChannelDescription, req.ChannelPassword)
	if err != nil {
		responses.SendError(w, fmt.Sprintf("Failed to create channel: %v", err), http.StatusInternalServerError)
		return
	}

	if err := database.CreateChannel(channel); err != nil {
		log.Printf("error creating channel %s in database: %v", req.ChannelName, err)
		responses.SendError(w, "Failed to create channel in database", http.StatusInternalServerError)
		return
	}

	responses.SendSuccess(w, channel, http.StatusOK)
}

func (h *Handlers) GetChannelsHandler(w http.ResponseWriter, r *http.Request) {
	channels, err := database.GetChannels()
	if err != nil {
		responses.SendError(w, fmt.Sprintf("Failed to get channels: %v", err), http.StatusInternalServerError)
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
		responses.SendError(w, "channel name required", http.StatusBadRequest)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		log.Println("ERROR: No claims found in context")
		return
	}
	isAdmin := h.chatServer.IsUserAdmin(req.ChannelName, claims.Username)
	if !isAdmin {
		responses.SendError(w, "not an admin of this channel", http.StatusForbidden)
		return
	}

	if err := h.chatServer.DeleteChannel(req.ChannelName, claims.Username); err != nil {
		responses.SendError(w, fmt.Sprintf("Failed to delete channel: %v", err), http.StatusInternalServerError)
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
		responses.SendError(w, "channel name required", http.StatusBadRequest)
		return
	}

	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		log.Println("ERROR: No claims found in context")
		return
	}

	if err := h.chatServer.LeaveChannel(claims.Username, req.ChannelName); err != nil {
		responses.SendError(w, fmt.Sprintf("Failed to leave channel: %v", err), http.StatusInternalServerError)
		return
	}

	responses.SendSuccess(w, fmt.Sprintf("Left channel: %s", req.ChannelName), http.StatusOK)
}
