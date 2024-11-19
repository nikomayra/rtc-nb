package middleware

import (
	"log"
	"net/http"
	"net/textproto"
	"rtc-nb/backend/api/responses"
	"rtc-nb/backend/helpers"
	"rtc-nb/backend/internal/auth"
	"strings"
	"time"
)

// Middleware function type
type Middleware func(http.Handler) http.Handler

// Chain applies middlewares in reverse order for correct execution
func Chain(handler http.Handler, middlewares ...Middleware) http.Handler {
	for i := len(middlewares) - 1; i >= 0; i-- {
		handler = middlewares[i](handler)
	}
	return handler
}

// Logger wraps http.ResponseWriter to capture status code
type responseLogger struct {
	http.ResponseWriter
	statusCode int
	written    bool
}

func (l *responseLogger) WriteHeader(code int) {
	if !l.written {
		l.statusCode = code
		l.ResponseWriter.WriteHeader(code)
		l.written = true
	}
}

// LoggingMiddleware logs request details and timing
func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Create logging wrapper
		logger := &responseLogger{w, http.StatusOK, false}

		// Process request
		next.ServeHTTP(logger, r)

		// Log request details
		log.Printf(
			"Method: %s Path: %s Status: %d Duration: %v",
			r.Method,
			r.URL.Path,
			logger.statusCode,
			time.Since(start),
		)
	})
}

// AuthMiddleware validates JWT tokens
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var token string

		// Check if this is a WebSocket upgrade request
		if helpers.IsWebSocketRequest(r) {
			// For WebSocket, get token from URL query parameter
			// token = r.URL.Query().Get("token")
			protocolHeader := textproto.CanonicalMIMEHeaderKey("Sec-WebSocket-Protocol")
			token = strings.TrimSpace(strings.Split(r.Header.Get(protocolHeader), ",")[1])
		} else {
			// For REST endpoints, get token from Authorization header
			token = r.Header.Get("Authorization")
			// Remove Bearer prefix if present
			if len(token) > 7 && token[:7] == "Bearer " {
				token = token[7:]
			}
		}

		// Check token presence
		if token == "" {
			responses.SendError(w, "No authorization token provided", http.StatusUnauthorized)
			return
		}

		// Verify token
		claims, err := auth.VerifyToken(token)
		if err != nil {
			responses.SendError(w, "Invalid or expired token", http.StatusUnauthorized)
			return
		}

		// Store full claims in context
		ctx := auth.NewContextWithClaims(r.Context(), &claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// MethodMiddleware ensures correct HTTP method
func MethodMiddleware(method string) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != method {
				responses.SendError(w, "Method not allowed", http.StatusMethodNotAllowed)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
