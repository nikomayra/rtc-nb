package auth

import (
	"testing"
)

func TestCreateAndValidateJWT(t *testing.T) {
    username := "testuser"
    token, err := createToken(username)
    if err != nil {
        t.Fatalf("Expected no error, got %v", err)
    }

    claims, err := verifyToken(token)
    if err != nil {
        t.Fatalf("Expected no error, got %v", err)
    }

    if claims.UserID != username {
        t.Fatalf("Expected username %v, got %v", username, claims.UserID)
    }
}
