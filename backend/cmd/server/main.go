package main

import (
	"log"
	"net/http"

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

	// Initialize Redis PubSub with config-provided client
	// cache := redis.NewCache(cfg.Redis)

	// Initialize websocket hub and handler
	connManager := connections.NewHub()
	connManager.StartCleanupTicker() // Stale connections cleanup

	// Initialize services
	chatService := chat.NewService(dbStore, fileStore, connManager)
	sketchService := sketch.NewService(dbStore)

	msgProcessor := messaging.NewProcessor(connManager, chatService, sketchService)
	
	wsHandler := websocket.NewHandler(connManager, msgProcessor)

	// Setup router and routes
	router := mux.NewRouter()
	api.RegisterRoutes(router, wsHandler, chatService, sketchService)

	// Serve static files from the filestore
	fs := http.FileServer(http.Dir(cfg.FileStorePath))
	router.PathPrefix("/files/").Handler(http.StripPrefix("/files/", fs))

	// TODO: serve the frontend from the dist folder for production
	// fs := http.FileServer(http.Dir("./dist"))
	// router.Handle("/", fs)

	log.Println("Server started on :8080")
	if err := http.ListenAndServe(":8080", router); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
