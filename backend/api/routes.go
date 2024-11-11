package api

// Route definitions for lobby management and game actions

import (
	"log"
	"net/http"
	"rtc-nb/backend/api/handlers"
	"rtc-nb/backend/api/middleware"
	"rtc-nb/backend/chat"
	"rtc-nb/backend/websocket"
)

func RegisterRoutes(mux *http.ServeMux, wsh *websocket.WebSocketHandler, chatServer *chat.ChatServer) {

    handlers := handlers.NewHandlers(chatServer)

	// Default route
	mux.HandleFunc("/", defaultRoute)

    // Public Routes
    mux.Handle("/register", middleware.Chain(
        http.HandlerFunc(handlers.RegisterHandler),
        middleware.LoggingMiddleware,
        middleware.MethodMiddleware("POST"),
    ))
    
    mux.Handle("/login", middleware.Chain(
        http.HandlerFunc(handlers.LoginHandler),
        middleware.LoggingMiddleware,
        middleware.MethodMiddleware("POST"),
    ))

    // Protected routes
    mux.Handle("/ws", middleware.Chain(
        http.HandlerFunc(wsh.HandleWebSocket),
        middleware.AuthMiddleware,
        middleware.LoggingMiddleware,
    ))
    
    mux.Handle("/joinchannel", middleware.Chain(
        http.HandlerFunc(handlers.JoinChannelHandler),
        middleware.AuthMiddleware,
        middleware.LoggingMiddleware,
    ))

}

func defaultRoute(w http.ResponseWriter, r *http.Request) {
    log.Printf("Served: %s", r.URL.Path)
    w.Write([]byte("Welcome to the server!"))
}
