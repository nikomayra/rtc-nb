package main

import (
	"log"
	"net/http"
	"os"

	"rtc-nb/backend/internal/config"
	"rtc-nb/backend/internal/connections"
	"rtc-nb/backend/internal/messaging"
	"rtc-nb/backend/internal/services/chat"
	"rtc-nb/backend/internal/services/sketch"
	"rtc-nb/backend/internal/store/database"
	"rtc-nb/backend/internal/store/storage/local"
	"rtc-nb/backend/internal/websocket"
	"rtc-nb/backend/pkg/api"

	"github.com/gorilla/mux"
)

func main() {
	cfg := config.Load()

	// Initialize store with config-provided DB
	dbStore, err := database.NewStore(cfg.DB)
	if err != nil {
		log.Fatalf("Failed to initialize store: %v", err)
	}
	defer dbStore.Close()

	fileStore, err := local.NewLocalFileStore(cfg.FileStorePath)
	if err != nil {
		log.Fatalf("Failed to initialize file store: %v", err)
	}

	// Initialize websocket hub and handler
	connManager := connections.NewHub()
	connManager.StartCleanupTicker() // Stale connections cleanup

	// Initialize the system channel for broadcasting system messages
	if err := connManager.InitializeChannel("system"); err != nil {
		log.Printf("Warning: Could not initialize system channel: %v", err)
	}

	// Initialize services
	chatService := chat.NewService(dbStore, fileStore, connManager)
	sketchService := sketch.NewService(dbStore, connManager)

	msgProcessor := messaging.NewProcessor(connManager, chatService, sketchService)

	wsHandler := websocket.NewHandler(connManager, msgProcessor)

	// Setup router and routes
	router := mux.NewRouter()
	api.RegisterRoutes(router, wsHandler, connManager, chatService, sketchService, cfg.FileStorePath, msgProcessor)

	// Determine port
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // Default port for local development
	}
	addr := ":" + port

	log.Printf("Server starting on %s", addr)
	if err := http.ListenAndServe(addr, router); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
