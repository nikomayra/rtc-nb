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

func SendJSON(w http.ResponseWriter, data interface{}, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func SendSuccess(w http.ResponseWriter, data interface{}, status int) {
	SendJSON(w, APIResponse{
		Success: true,
		Data:    data,
	}, status)
}

func SendError(w http.ResponseWriter, message string, status int) {
	SendJSON(w, APIResponse{
		Success: false,
		Error: &APIError{
			Message: message,
			Code:    status,
		},
	}, status)
}
