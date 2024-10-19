package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"
)

const EXPIRE_HOURS = 24

type Header struct {
	Type string `json:"type"`
	Algorithm string `json:"algorithm"`
}

type Payload struct {
	UserID string `json:"user_id"`
	Expiration int64 `json:"expiration"`
}

// Encode header & payload as JSON as base64-URL
// Create a signature using SECRET_KEY
func createToken (userID string) (string, error) {
	// Create Go objects
	header := Header{Type: "JWT", Algorithm: "HS256"}
	payload := Payload{UserID: userID, Expiration: time.Now().Add(EXPIRE_HOURS * time.Hour).Unix()}
	
	// Convert Go objects to JSON
	headerJSON, _ := json.Marshal(header)
	payloadJSON, _ := json.Marshal(payload)

	// Encode JSON as base64-URL
	headerEncoded := base64.RawURLEncoding.EncodeToString(headerJSON)
	payloadEncoded := base64.RawURLEncoding.EncodeToString(payloadJSON)

	// Create Signature
	signature := createSignature(headerEncoded, payloadEncoded)
    return fmt.Sprintf("%s.%s.%s", headerEncoded, payloadEncoded, signature), nil
}

func createSignature(header, payload string) string {
    h := hmac.New(sha256.New, []byte(os.Getenv("SECRET_KEY")))
    h.Write([]byte(fmt.Sprintf("%s.%s", header, payload)))
    return base64.RawURLEncoding.EncodeToString(h.Sum(nil))
}

func verifyToken(token string) (Payload, error) {
	parts := strings.Split(token, ".") // Split token by "."
	if len(parts) != 3 {
		return Payload{}, fmt.Errorf("invalid token")
	}

	header := parts[0]
	payload := parts[1]
	signature := parts[2]

	// Compare received signature with expected generated signature
	expectedSignature := createSignature(header, payload)
	if expectedSignature != signature {
		return Payload{}, fmt.Errorf("invalid signature")
	}

	// Decode payload string into original bytes
	payloadBytes, err := base64.RawURLEncoding.DecodeString(payload)
	if err != nil {
		return Payload{}, err
	}

	// Parse decoded payloadbytes back into Payload object
	var claims Payload
	err = json.Unmarshal(payloadBytes, &claims)
	if err != nil {
		return Payload{}, err
	}

	if claims.Expiration < time.Now().Unix() {
		return Payload{}, fmt.Errorf("token expired")
	}

	return claims, nil
}