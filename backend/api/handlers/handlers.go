package handlers

// Handlers for the routes defined in routes.go

import (
	"encoding/json"
	"log"
	"net/http"
	"rtc-nb/backend/api/responses"
	"rtc-nb/backend/internal/auth"
	"rtc-nb/backend/internal/database"
	"rtc-nb/backend/internal/models"
)

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
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
	storedUser, err := database.GetUserByUsername(req.Username)
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
	
	// Create new user
	user := models.NewUser(req.Username, hashedPassword)

	// Add new user to database
	if err := database.AddNewUser(user); err != nil{
		log.Printf("error adding new user %s to database: %v", req.Username, err)
		responses.SendError(w, "Failed to add new user", http.StatusInternalServerError)
		return
	}

	// Generate JWT token
    token, err := auth.CreateToken(req.Username)
    if err != nil {
		log.Printf("error generating token for user %s: %v", req.Username, err)
        responses.SendError(w, "Error generating token", http.StatusInternalServerError)
        return
    }

	// Success response
    responses.SendJSON(w, map[string]interface{}{
        "token": token,
        "username": req.Username,
    }, http.StatusCreated)
	
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
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
	storedUser, err := database.GetUserByUsername(req.Username)
    if err != nil {
		log.Printf("Error fetching user by username: %v", err)
        responses.SendError(w, "Invalid credentials", http.StatusUnauthorized)
        return
    }

    // Validate the provided password against the stored hash
    if err = auth.CheckPassword(storedUser.Password, req.Password); err != nil {
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
    responses.SendJSON(w, map[string]interface{}{
        "token":    token,
        "username": req.Username,
    }, http.StatusOK)
}