package responses

import (
	"encoding/json"
	"net/http"
)

// Response represents a standard API response
type Response struct {
    Success bool        `json:"success"`
    Data    interface{} `json:"data,omitempty"`
    Error   *ErrorInfo  `json:"error,omitempty"`
}

// ErrorInfo represents error details
type ErrorInfo struct {
    Message string `json:"message"`
    Code    int    `json:"code"`
}

// Custom ResponseWriter to capture status code
type ResponseWriter struct {
    http.ResponseWriter
    statusCode int
}

func NewResponseWriter(w http.ResponseWriter) *ResponseWriter {
    return &ResponseWriter{w, http.StatusOK}
}

func (rw *ResponseWriter) WriteHeader(code int) {
    rw.statusCode = code
    rw.ResponseWriter.WriteHeader(code)
}

func (rw *ResponseWriter) StatusCode() int {
    return rw.statusCode
}

// JSON sends a JSON response
func JSON(w http.ResponseWriter, data interface{}, status int) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    
    response := Response{
        Success: status >= 200 && status < 300,
        Data:    data,
    }
    
    json.NewEncoder(w).Encode(response)
}

// ErrorJSON sends an error response
func ErrorJSON(w http.ResponseWriter, message string, status int) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    
    response := Response{
        Success: false,
        Error: &ErrorInfo{
            Message: message,
            Code:    status,
        },
    }
    
    json.NewEncoder(w).Encode(response)
}