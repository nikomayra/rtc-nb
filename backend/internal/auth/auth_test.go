package auth

import (
	"testing"
)

func TestCreateAndValidateJWT(t *testing.T) {
    username := "testuser"
    token, err := CreateToken(username)
    if err != nil {
        t.Fatalf("Expected no error, got %v", err)
    }
    t.Log("Token created successfully")

    claims, err := VerifyToken(token)
    if err != nil {
        t.Fatalf("Expected no error, got %v", err)
    }
    t.Log("Token verified successfully")

    if claims.Username != username {
        t.Fatalf("Expected username %v, got %v", username, claims.Username)
    }
    t.Log("Token decoded username matches")
}

func TestHashAndCheckPassword(t *testing.T) {
    password := "mySecretPassword"
    hashedPassword, err := HashPassword(password)
    if err != nil {
        t.Fatalf("Error while hashing password: %v", err)
    }
    t.Log("Password hashed successfully")

    err = CheckPassword(hashedPassword, password)
    if err != nil {
        t.Errorf("Password did not match, expected it to match")
    }
    t.Log("Password match check passed")
}