package utils

import (
	"sync"
	"time"
)

type RateLimiter struct {
	mu      sync.Mutex
	last    time.Time
	tokens  int
	rate    time.Duration
	burst   int
}

func NewRateLimiter(rate time.Duration, burst int) *RateLimiter {
	return &RateLimiter{
		last:   time.Now(),
		tokens: burst,
		rate:   rate,
		burst:  burst,
	}
}

func (rl *RateLimiter) Allow() bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	
	now := time.Now()
	elapsed := now.Sub(rl.last)
	newTokens := int(elapsed / rl.rate)
	
	if newTokens > 0 {
		rl.tokens = min(rl.tokens + newTokens, rl.burst)
		rl.last = now
	}
	
	if rl.tokens > 0 {
		rl.tokens--
		return true
	}
	return false
}
