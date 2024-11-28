package middleware

import (
	"bufio"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/textproto"
	"strings"
	"time"

	"rtc-nb/backend/internal/auth"
	"rtc-nb/backend/pkg/api/responses"
	"rtc-nb/backend/pkg/utils"
)

// Middleware function type
type Middleware func(http.Handler) http.Handler

// Logger wraps http.ResponseWriter to capture status code
type responseLogger struct {
	http.ResponseWriter
	statusCode int
	written    bool
}

func (l *responseLogger) WriteHeader(code int) {
	if !l.written {
		l.ResponseWriter.WriteHeader(code)
		l.statusCode = code
		l.written = true
	}
}

func (l *responseLogger) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := l.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, fmt.Errorf("responseWriter doesn't support hijacking")
	}
	return hijacker.Hijack()
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
		if utils.IsWebSocketRequest(r) {
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
		claims, err := auth.ValidateAccessToken(token)
		//log.Printf("AuthMiddleware Claims: %v\n", claims)
		if err != nil {
			responses.SendError(w, "Invalid or expired token", http.StatusUnauthorized)
			return
		}

		// Store full claims in context
		ctx := auth.NewContextWithClaims(r.Context(), &claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
