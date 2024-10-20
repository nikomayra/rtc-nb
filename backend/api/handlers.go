package api

// Handlers for the routes defined in routes.go

import (
	"fmt"
	"net/http"
	"rtc-nb/backend/auth"
	"rtc-nb/backend/models"
)

func register(w http.ResponseWriter, r *http.Request) {
	username, password := r.FormValue("username"), r.FormValue("password")

	// Check DB to see if username already is taken
	if taken := checkIfUsernameUniqueInDB(username); taken {
		http.Error(w, "Username taken", http.StatusConflict)
		return
	}

	// Hash password
	hashedPassword, err := auth.HashPassword(password)
	if err != nil {
		http.Error(w, "Password hashing failed", http.StatusInternalServerError)
		return
	}
	
	// Create new user
	user := &models.User{
		Username: username,
		Password: hashedPassword,
		Highscore: 0,
		Guess: "",
	}

	// Add new user to database
	if err := addNewUserToDB(*user); err != nil{
		http.Error(w, "User create failed", http.StatusInternalServerError)
		return
	}

	
}

func login(w http.ResponseWriter, r *http.Request) {
	// Parse username/password from request
    username, password := r.FormValue("username"), r.FormValue("password")
    
    /// Hash password
	hashedPassword, err := auth.HashPassword(password)
	if err != nil {
		http.Error(w, "Password hashing failed", http.StatusInternalServerError)
		return
	}

    // Check hashed password against the database
    if valid := ValidateUserPasswordInDB(username, hashedPassword); !valid {
        http.Error(w, "Invalid credentials", http.StatusUnauthorized)
        return
    }

    // Generate JWT on successful login
    token, err := auth.CreateToken(username)
    if err != nil {
        http.Error(w, "Error generating token", http.StatusInternalServerError)
        return
    }

    // Send JWT to client
    w.Header().Set("Authorization", "Bearer "+token)
    fmt.Fprintf(w, "Login successful")
}