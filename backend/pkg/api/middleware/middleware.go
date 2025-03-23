package middleware

import (
	"bufio"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/textproto"
	"strings"
	"sync"
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

type RateLimiter struct {
	requests map[string][]time.Time
	wsConns  map[string]int
	mu       sync.Mutex
}

func NewRateLimiter() *RateLimiter {
	return &RateLimiter{
		requests: make(map[string][]time.Time),
		wsConns:  make(map[string]int),
	}
}

func (l *responseLogger) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := l.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, fmt.Errorf("responseWriter doesn't support hijacking")
	}
	return hijacker.Hijack()
}

func (rl *RateLimiter) RateLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get IP and strip port number if present
		ip := r.Header.Get("X-Forwarded-For")
		if ip == "" {
			ip = r.RemoteAddr
			if i := strings.LastIndex(ip, ":"); i != -1 {
				ip = ip[:i]
			}
		}

		rl.mu.Lock()
		now := time.Now()

		// Debug logging
		// log.Printf("Rate limiting request from IP: %s, Current count: %d", ip, len(rl.requests[ip]))

		// Rest of the function remains the same...
		if times, exists := rl.requests[ip]; exists {
			valid := make([]time.Time, 0)
			for _, t := range times {
				if now.Sub(t) < time.Minute {
					valid = append(valid, t)
				}
			}
			rl.requests[ip] = valid
		}

		rl.requests[ip] = append(rl.requests[ip], now)

		// Lower limit for testing
		if len(rl.requests[ip]) > 120 {
			rl.mu.Unlock()
			// log.Printf("Rate limit exceeded for IP: %s, Count: %d", ip, len(rl.requests[ip]))
			w.Header().Set("Retry-After", "60")
			http.Error(w, "Rate limit exceeded. Try again in 1 minute.", http.StatusTooManyRequests)
			return
		}
		rl.mu.Unlock()

		next.ServeHTTP(w, r)
	})
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
			"%s %s %d %v",
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
		//log.Printf("AuthMiddleware Token: %s", token)
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
