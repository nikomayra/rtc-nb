package responses

import (
	"encoding/json"
	"net/http"
)

// APIResponse represents our standard response structure
type APIResponse struct {
    Success bool        `json:"success"`
    Data    interface{} `json:"data,omitempty"`
    Error   *APIError   `json:"error,omitempty"`
}

// APIError represents error details
type APIError struct {
    Message string `json:"message"`
    Code    int    `json:"code"`
}

// SendJSON sends a success response
func SendJSON(w http.ResponseWriter, data interface{}, status int) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    
    response := APIResponse{
        Success: true,
        Data:    data,
    }
    
    json.NewEncoder(w).Encode(response)
}

// SendError sends an error response
func SendError(w http.ResponseWriter, message string, status int) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    
    response := APIResponse{
        Success: false,
        Error: &APIError{
            Message: message,
            Code:    status,
        },
    }
    
    json.NewEncoder(w).Encode(response)
}