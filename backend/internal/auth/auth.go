package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"rtc-nb/backend/internal/models"

	"golang.org/x/crypto/bcrypt"
)

type contextKey string

const ClaimsContextKey contextKey = "claims"

var (
	ErrInvalidToken     = fmt.Errorf("invalid token format")
	ErrExpiredToken     = fmt.Errorf("token has expired")
	ErrInvalidSignature = fmt.Errorf("invalid token signature")
)

// AuthService defines the interface for authentication-related actions.
type AuthService interface {
	GenerateAccessToken(user models.User) (string, error)
	GenerateRefreshToken(user models.User) (string, error)
	ValidateAccessToken(token string) (Claims, error)
	RefreshAccessToken(refreshToken string) (string, error)
	HashPassword(password string) (string, error)
	CheckPassword(hashedPassword, password string) error
}

type Claims struct {
	Username  string    `json:"username"`
	ExpiresAt time.Time `json:"exp"`
	IssuedAt  time.Time `json:"iat"`
}

func NewContextWithClaims(ctx context.Context, claims *Claims) context.Context {
	return context.WithValue(ctx, ClaimsContextKey, claims)
}

func ClaimsFromContext(ctx context.Context) (*Claims, bool) {
	claims, ok := ctx.Value(ClaimsContextKey).(*Claims)
	return claims, ok
}

type JWTService struct {
	secretKey string
}

func (jwt *JWTService) GenerateRefreshToken(user User) (string, error) {
	// Logic to generate refresh token
	return "some-refresh-token", nil
}

func (jwt *JWTService) RefreshAccessToken(refreshToken string) (string, error) {
	// Logic to refresh access token
	return "new-access-token", nil
}

func (jwt *JWTService) GenerateAccessToken(user User) (string, error) {
	now := time.Now()
	claims := Claims{
		Username:  user.Username,
		IssuedAt:  now,
		ExpiresAt: now.Add(24 * time.Hour),
	}

	// Convert claims to JSON
	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	// Create header
	header := map[string]string{
		"typ": "JWT",
		"alg": "HS256",
	}
	headerJSON, _ := json.Marshal(header)

	// Encode header and payload
	headerEncoded := base64.RawURLEncoding.EncodeToString(headerJSON)
	payloadEncoded := base64.RawURLEncoding.EncodeToString(payload)

	// Create signature
	signature := createSignature(headerEncoded, payloadEncoded)

	return fmt.Sprintf("%s.%s.%s", headerEncoded, payloadEncoded, signature), nil
}

func (jwt *JWTService) ValidateAccessToken(token string) (Claims, error) {
	parts := strings.Split(token, ".") // Split token by "."
	if len(parts) != 3 {
		return Claims{}, ErrInvalidToken
	}

	header := parts[0]
	payload := parts[1]
	signature := parts[2]

	// Compare received signature with expected generated signature
	expectedSignature := createSignature(header, payload)
	if expectedSignature != signature {
		return Claims{}, ErrInvalidSignature
	}

	// Decode payload string into original bytes
	payloadBytes, err := base64.RawURLEncoding.DecodeString(payload)
	if err != nil {
		return Claims{}, err
	}

	// Parse decoded payloadbytes back into Payload object
	var claims Claims
	err = json.Unmarshal(payloadBytes, &claims)
	if err != nil {
		return Claims{}, err
	}

	if claims.ExpiresAt.Before(time.Now()) {
		return Claims{}, ErrExpiredToken
	}

	return claims, nil
}

func createSignature(header, payload string) string {
	h := hmac.New(sha256.New, []byte(os.Getenv("SECRET_KEY")))
	h.Write([]byte(fmt.Sprintf("%s.%s", header, payload)))
	return base64.RawURLEncoding.EncodeToString(h.Sum(nil))
}

func HashPassword(password string) (string, error) {
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
