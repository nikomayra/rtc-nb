package api

import (
	"log"
	"net/http"

	"rtc-nb/backend/internal/services/chat"
	"rtc-nb/backend/internal/websocket"
	"rtc-nb/backend/pkg/api/handlers"
	"rtc-nb/backend/pkg/api/middleware"
)

func RegisterRoutes(router *http.ServeMux, wsh *websocket.WebSocketHandler, chatService *chat.ChatService) {
	// Create a subrouter for /api
	apiHandler := http.NewServeMux()
	router.Handle("/api/", http.StripPrefix("/api", apiHandler))

	handlers := handlers.NewHandlers(chatService)

	// Unprotected routes
	apiHandler.HandleFunc("/", defaultRoute)

	apiHandler.Handle("/register", middleware.Chain(
		http.HandlerFunc(handlers.RegisterHandler),
		middleware.LoggingMiddleware,
		middleware.MethodMiddleware("POST"),
	))

	apiHandler.Handle("/login", middleware.Chain(
		http.HandlerFunc(handlers.LoginHandler),
		middleware.LoggingMiddleware,
		middleware.MethodMiddleware("POST"),
	))

	// Protected routes
	apiHandler.Handle("/ws", middleware.Chain(
		http.HandlerFunc(wsh.HandleWebSocket),
		middleware.AuthMiddleware,
		middleware.LoggingMiddleware,
	))

	apiHandler.Handle("/joinchannel", middleware.Chain(
		http.HandlerFunc(handlers.JoinChannelHandler),
		middleware.AuthMiddleware,
		middleware.LoggingMiddleware,
		middleware.MethodMiddleware("POST"),
	))

	apiHandler.Handle("/createchannel", middleware.Chain(
		http.HandlerFunc(handlers.CreateChannelHandler),
		middleware.AuthMiddleware,
		middleware.LoggingMiddleware,
		middleware.MethodMiddleware("POST"),
	))

	apiHandler.Handle("/deletechannel", middleware.Chain(
		http.HandlerFunc(handlers.DeleteChannelHandler),
		middleware.AuthMiddleware,
		middleware.LoggingMiddleware,
		middleware.MethodMiddleware("POST"),
	))

	apiHandler.Handle("/leavechannel", middleware.Chain(
		http.HandlerFunc(handlers.LeaveChannelHandler),
		middleware.AuthMiddleware,
		middleware.LoggingMiddleware,
		middleware.MethodMiddleware("POST"),
	))

	apiHandler.Handle("/channels", middleware.Chain(
		http.HandlerFunc(handlers.GetChannelsHandler),
		middleware.AuthMiddleware,
		middleware.LoggingMiddleware,
		middleware.MethodMiddleware("GET"),
	))
}

func defaultRoute(w http.ResponseWriter, r *http.Request) {
	log.Printf("Served: %s", r.URL.Path)
	w.Write([]byte("Welcome to the server!"))
}
