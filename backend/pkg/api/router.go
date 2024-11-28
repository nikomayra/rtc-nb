package api

import (
	"log"
	"net/http"

	"github.com/gorilla/mux"

	"rtc-nb/backend/internal/services/chat"
	"rtc-nb/backend/internal/websocket"
	"rtc-nb/backend/pkg/api/handlers"
	"rtc-nb/backend/pkg/api/middleware"
)

func RegisterRoutes(router *mux.Router, wsh *websocket.WebSocketHandler, chatService *chat.ChatService) {
	// Create a subrouter for /api with common middleware
	apiRouter := router.PathPrefix("/api").Subrouter()

	// Apply global middleware to all routes
	apiRouter.Use(middleware.LoggingMiddleware)

	handlers := handlers.NewHandlers(chatService)

	// Unprotected routes
	apiRouter.HandleFunc("/", defaultRoute).Methods("GET")
	apiRouter.HandleFunc("/register", handlers.RegisterHandler).Methods("POST")
	apiRouter.HandleFunc("/login", handlers.LoginHandler).Methods("POST")

	// Protected routes - create a subrouter with auth middleware
	protected := apiRouter.NewRoute().Subrouter()
	protected.Use(middleware.AuthMiddleware)

	protected.HandleFunc("/ws", wsh.HandleWebSocket).Methods("GET")
	protected.HandleFunc("/joinchannel", handlers.JoinChannelHandler).Methods("PATCH")
	protected.HandleFunc("/createchannel", handlers.CreateChannelHandler).Methods("POST")
	protected.HandleFunc("/deletechannel", handlers.DeleteChannelHandler).Methods("DELETE")
	protected.HandleFunc("/leavechannel", handlers.LeaveChannelHandler).Methods("PATCH")
	protected.HandleFunc("/channels", handlers.GetChannelsHandler).Methods("GET")
}

func defaultRoute(w http.ResponseWriter, r *http.Request) {
	log.Printf("Served: %s", r.URL.Path)
	w.Write([]byte("Welcome to the server!"))
}
