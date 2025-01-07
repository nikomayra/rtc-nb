package api

import (
	"log"
	"net/http"

	"github.com/gorilla/mux"

	"rtc-nb/backend/internal/connections"
	"rtc-nb/backend/internal/services/chat"
	"rtc-nb/backend/internal/services/sketch"
	"rtc-nb/backend/internal/websocket"
	"rtc-nb/backend/pkg/api/handlers"
	"rtc-nb/backend/pkg/api/middleware"
)

func RegisterRoutes(router *mux.Router, wsh *websocket.Handler, connManager connections.Manager, chatService chat.ChatManager, sketchService *sketch.Service) {
	// Create a subrouter for /api with common middleware
	apiRouter := router.PathPrefix("/api").Subrouter()

	// Apply global middleware to all routes
	apiRouter.Use(middleware.LoggingMiddleware)

	handlers := handlers.NewHandlers(connManager, chatService, sketchService)

	// Unprotected routes
	apiRouter.HandleFunc("/", defaultRoute).Methods("GET")
	apiRouter.HandleFunc("/register", handlers.RegisterHandler).Methods("POST")
	apiRouter.HandleFunc("/login", handlers.LoginHandler).Methods("POST")

	// Protected routes - create a subrouter with auth middleware
	protected := apiRouter.NewRoute().Subrouter()
	protected.Use(middleware.AuthMiddleware)

	protected.HandleFunc("/ws/{channelName}", wsh.HandleWebSocket)
	protected.HandleFunc("/joinchannel", handlers.JoinChannelHandler).Methods("PATCH")
	protected.HandleFunc("/createchannel", handlers.CreateChannelHandler).Methods("POST")
	protected.HandleFunc("/deletechannel/{channelName}", handlers.DeleteChannelHandler).Methods("DELETE")
	protected.HandleFunc("/leavechannel/{channelName}", handlers.LeaveChannelHandler).Methods("PATCH")
	protected.HandleFunc("/channels", handlers.GetChannelsHandler).Methods("GET")

	protected.HandleFunc("/validatetoken", handlers.ValidateTokenHandler).Methods("GET")
	protected.HandleFunc("/logout", handlers.LogoutHandler).Methods("POST")
	protected.HandleFunc("/deleteaccount", handlers.DeleteAccountHandler).Methods("DELETE")

	protected.HandleFunc("/upload", handlers.UploadHandler).Methods("POST")
	protected.HandleFunc("/getMessages/{channelName}", handlers.GetMessagesHandler).Methods("GET")

	protected.HandleFunc("/createSketch", handlers.CreateSketchHandler).Methods("POST")
	protected.HandleFunc("/channels/{channelName}/sketches/{sketchId}", handlers.GetSketchHandler).Methods("GET")
	protected.HandleFunc("/getSketches/{channelName}", handlers.GetSketchesHandler).Methods("GET")
	protected.HandleFunc("/deleteSketch/{sketchId}", handlers.DeleteSketchHandler).Methods("DELETE")
}

func defaultRoute(w http.ResponseWriter, r *http.Request) {
	log.Printf("Served: %s", r.URL.Path)
	w.Write([]byte("Welcome to the server!"))
}
