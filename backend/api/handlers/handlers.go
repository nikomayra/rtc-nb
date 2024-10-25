package handlers

// Handlers for the routes defined in routes.go

import (
	"encoding/json"
	"fmt"
	"net/http"
	"rtc-nb/backend/auth"
	"rtc-nb/backend/database"
	"rtc-nb/backend/models"
)

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	// Parse username/password from request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
    	http.Error(w, "Invalid request", http.StatusBadRequest)
    return
	}

	// Check DB to see if username already is taken
	if taken := database.CheckIfUsernameUnique(req.Username); taken {
		http.Error(w, "Username taken", http.StatusConflict)
		return
	}

	// Hash password
	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		http.Error(w, "Password hashing failed", http.StatusInternalServerError)
		return
	}
	
	// Create new user
	user := models.NewUser(req.Username, hashedPassword)

	// Add new user to database
	if err := database.AddNewUser(user); err != nil{
		http.Error(w, "User create failed", http.StatusInternalServerError)
		return
	}

	
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
    var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	// Parse username/password from request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
    	http.Error(w, "Invalid request", http.StatusBadRequest)
    return
	}
    
    /// Get hashed user password from DB
	storedHashedPassword, err := database.GetHashPasswordbyUsername(req.Password)
	if err != nil {
		http.Error(w, "Password not found in DB", http.StatusInternalServerError)
	}

    // Check stored hash password to request string password
    err = auth.CheckPassword(storedHashedPassword, req.Password)
	if err != nil {
        http.Error(w, "Invalid credentials", http.StatusUnauthorized)
        return
    }

    // Generate JWT on successful login
    token, err := auth.CreateToken(req.Username)
    if err != nil {
        http.Error(w, "Error generating token", http.StatusInternalServerError)
        return
    }

    // Send JWT to client
    w.Header().Set("Authorization", "Bearer "+token)
    fmt.Fprintf(w, "Login successful")
}