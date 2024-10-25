package api

// Route definitions for lobby management and game actions

import (
	"log"
	"net/http"
	"rtc-nb/backend/api/handlers"
	"rtc-nb/backend/api/middleware"
)

func RegisterRoutes(mux *http.ServeMux) {
    // Public Routes
    mux.HandleFunc("/login", middleware.Chain(
        handlers.LoginHandler,
        middleware.LoggingMiddleware,
        middleware.MethodMiddleware("POST"),
    ))

    mux.HandleFunc("/register", middleware.Chain(
        handlers.RegisterHandler,
        middleware.LoggingMiddleware,
        middleware.MethodMiddleware("POST"),
    ))



    // Protected routes
}

func DefaultRoute(w http.ResponseWriter, r *http.Request) {
    log.Printf("Served: %s", r.URL.Path)
    w.Write([]byte("Welcome to the server!"))
}
