package middleware

import (
	"context"
	"log"
	"net/http"
	"rtc-nb/backend/internal/responses"
	"time"
)

// Middleware type that wraps http.Handler and returns a new handler
type Middleware func(http.HandlerFunc) http.HandlerFunc

// Chain applies middlewares in reverse order (right to left)
// This matches the logical order they'll execute in
func Chain(handler http.HandlerFunc, middlewares ...Middleware) http.HandlerFunc {
    // Apply in reverse order
    for i := len(middlewares) - 1; i >= 0; i-- {
        handler = middlewares[i](handler)
    }
    return handler
}

// MethodMiddleware ensures the request uses the correct HTTP method
func MethodMiddleware(method string) Middleware {
    return func(next http.HandlerFunc) http.HandlerFunc {
        return func(w http.ResponseWriter, r *http.Request) {
            if r.Method != method {
                responses.ErrorJSON(w, "Method not allowed", http.StatusMethodNotAllowed)
                return
            }
            next(w, r)
        }
    }
}

// LoggingMiddleware logs request details and timing
func LoggingMiddleware(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        
        // Create a custom response writer to capture status code
        rw := responses.NewResponseWriter(w)
        
        // Process request
        next(rw, r)
        
        // Log after completion
        duration := time.Since(start)
        log.Printf(
            "Method: %s Path: %s Status: %d Duration: %v",
            r.Method, 
            r.URL.Path, 
            rw.StatusCode(), 
            duration,
        )
    }
}

// AuthMiddleware handles authentication
func AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        token := r.Header.Get("Authorization")
        if token == "" {
            responses.ErrorJSON(w, "No authorization token provided", http.StatusUnauthorized)
            return
        }

        // You would validate the token here
        // userID, err := auth.ValidateToken(token)
        // if err != nil {
        //     responses.ErrorJSON(w, "Invalid token", http.StatusUnauthorized)
        //     return
        // }

        // Store user info in context for handlers
        ctx := context.WithValue(r.Context(), "userID", "dummy-user-id")
        next(w, r.WithContext(ctx))
    }
}