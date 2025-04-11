package api

import (
	"log"
	"net/http"
	"os"            // Import os package
	"path/filepath" // Import path/filepath package

	"github.com/gorilla/mux"

	"rtc-nb/backend/internal/auth"
	"rtc-nb/backend/internal/connections"
	"rtc-nb/backend/internal/messaging"
	"rtc-nb/backend/internal/services/chat"
	"rtc-nb/backend/internal/services/sketch"
	"rtc-nb/backend/internal/websocket"
	"rtc-nb/backend/pkg/api/handlers"
	"rtc-nb/backend/pkg/api/middleware"
)

func RegisterRoutes(router *mux.Router, wsh *websocket.Handler, connManager connections.Manager, chatService chat.ChatManager, sketchService *sketch.Service,
	fileStorePath string, msgProcessor *messaging.Processor) {

	// Define the directory where frontend build output is located
	staticDir := "./static"

	// Apply global middleware (Rate Limiter)
	limiter := middleware.NewRateLimiter()
	router.Use(limiter.RateLimit)

	// --- API Routes --- (Register these BEFORE the static file handler)
	// Create a subrouter for /api with common middleware
	apiRouter := router.PathPrefix("/api").Subrouter()
	apiRouter.Use(middleware.LoggingMiddleware)

	handlers := handlers.NewHandlers(connManager, chatService, sketchService, msgProcessor)

	// -- Unprotected API routes --
	apiRouter.HandleFunc("/", defaultRoute).Methods("GET")
	apiRouter.HandleFunc("/register", handlers.RegisterHandler).Methods("POST")
	apiRouter.HandleFunc("/login", handlers.LoginHandler).Methods("POST")

	// -- Protected API routes --
	protected := apiRouter.NewRoute().Subrouter()
	protected.Use(middleware.AuthMiddleware)

	// Handle websocket connections
	protected.HandleFunc("/ws/system", wsh.HandleSystemWebSocket)
	protected.HandleFunc("/ws/{channelName}", wsh.HandleWebSocket)

	// Chat routes
	protected.HandleFunc("/joinChannel/{channelName}", handlers.JoinChannelHandler).Methods("PATCH")
	protected.HandleFunc("/createChannel/{channelName}", handlers.CreateChannelHandler).Methods("POST")
	protected.HandleFunc("/deleteChannel/{channelName}", handlers.DeleteChannelHandler).Methods("DELETE")
	protected.HandleFunc("/leaveChannel/{channelName}", handlers.LeaveChannelHandler).Methods("PATCH")
	protected.HandleFunc("/channels", handlers.GetChannelsHandler).Methods("GET")
	protected.HandleFunc("/channels/{channelName}/members/{username}/role", handlers.UpdateChannelMemberRole).Methods("PATCH")
	protected.HandleFunc("/channels/{channelName}/members", handlers.GetChannelMembersHandler).Methods("GET")

	// -- Messages routes
	protected.HandleFunc("/upload", handlers.UploadHandler).Methods("POST")
	protected.HandleFunc("/getMessages/{channelName}", handlers.GetMessagesHandler).Methods("GET")

	// Auth routes
	protected.HandleFunc("/validateToken", handlers.ValidateTokenHandler).Methods("GET")
	protected.HandleFunc("/logout", handlers.LogoutHandler).Methods("PATCH")
	protected.HandleFunc("/deleteAccount", handlers.DeleteAccountHandler).Methods("DELETE")

	// Online users routes
	protected.HandleFunc("/onlineUsers/{channelName}", handlers.GetOnlineUsersInChannelHandler).Methods("GET")
	protected.HandleFunc("/onlineUsersCount", handlers.GetAllOnlineUsersHandler).Methods("GET")

	// Sketch routes
	protected.HandleFunc("/createSketch", handlers.CreateSketchHandler).Methods("POST")
	protected.HandleFunc("/channels/{channelName}/sketches/{sketchId}", handlers.GetSketchHandler).Methods("GET")
	protected.HandleFunc("/channels/{channelName}/sketches", handlers.GetSketchesHandler).Methods("GET")
	protected.HandleFunc("/deleteSketch/{sketchId}", handlers.DeleteSketchHandler).Methods("DELETE")
	protected.HandleFunc("/clearSketch", handlers.ClearSketchHandler).Methods("POST")

	// -- File serving for uploads -- (Keep this under /api/files for consistency)
	// Simple auth wrapper for serving uploaded files
	uploadFileServer := http.FileServer(http.Dir(fileStorePath))
	uploadFileHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := r.URL.Query().Get("token")
		if _, err := auth.ValidateAccessToken(token); err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		uploadFileServer.ServeHTTP(w, r)
	})
	// Serve uploaded files from /api/files/ (Requires token in query param)
	apiRouter.PathPrefix("/files/").Handler(http.StripPrefix("/api/files/", uploadFileHandler))

	// --- Static Frontend File Serving --- (Register this LAST)
	// This handles serving the index.html and other assets like CSS, JS
	staticFileServer := http.FileServer(http.Dir(staticDir))

	// Use PathPrefix to catch all non-API routes
	router.PathPrefix("/").Handler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Construct the path to the file in the static directory
		filePath := filepath.Join(staticDir, r.URL.Path)

		// Check if the requested path corresponds to an existing file
		_, err := os.Stat(filePath) // Check file status

		if err == nil { // Case 1: File exists
			// Serve the existing file (e.g., CSS, JS, images)
			staticFileServer.ServeHTTP(w, r)
		} else if os.IsNotExist(err) { // Case 2: File does NOT exist
			// Serve the index.html for SPA routing (let React Router handle it)
			http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
		} else { // Case 3: Other error (e.g., permissions)
			// Log the error and return a generic server error
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			log.Printf("Error checking static file %s: %v", filePath, err)
		}
	}))
}

func defaultRoute(w http.ResponseWriter, r *http.Request) {
	log.Printf("Served API default: %s", r.URL.Path)
	w.Write([]byte("Welcome to the API!"))
}
