package auth

import (
	"golang.org/x/crypto/bcrypt"
)

func HashPassword(password string)(string, error){
	// Hash password with default cost
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashedPassword), nil
}

func CheckPassword(hashedPassword, password string) error {
	// Comparing the hashed password to string password
	return bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
}