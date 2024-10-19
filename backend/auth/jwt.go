package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
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
	h := hmac.New(sha256.New, []byte(os.Getenv("SECRET_KEY")))
	h.Write([]byte(fmt.Sprintf("%s.%s", headerEncoded, payloadEncoded)))
	signature := base64.RawURLEncoding.EncodeToString((h.Sum(nil)))
	return fmt.Sprintf("%s.%s.%s", headerEncoded, payloadEncoded, signature), nil
}

func verifyToken(){
	
}

func main(){
	createToken("Test_User")
}