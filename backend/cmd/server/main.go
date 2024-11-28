package main

import (
	"log"
	"net/http"

	"rtc-nb/backend/internal/config"
	"rtc-nb/backend/internal/repositories"
	"rtc-nb/backend/internal/services/chat"
	"rtc-nb/backend/internal/store/database"
	"rtc-nb/backend/internal/store/redis"
	"rtc-nb/backend/internal/websocket"
	"rtc-nb/backend/pkg/api"

	"github.com/gorilla/mux"
)

func main() {
	cfg := config.Load()

	// Initialize store with config-provided DB
	store, err := database.NewStore(cfg.DB)
	if err != nil {
		log.Fatalf("Failed to initialize store: %v", err)
	}
	defer store.Close()

	// Initialize Redis PubSub with config-provided client
	pubSub := redis.NewPubSub(cfg.Redis)

	// Initialize repository with store
	repo := repositories.NewRepository(store)

	// Initialize websocket hub and handler
	wsHub := websocket.NewHub()
	wsHandler := websocket.NewWebSocketHandler(wsHub)

	// Initialize chat service
	chatService := chat.NewService(repo, pubSub, wsHub)

	// Setup router and routes
	router := mux.NewRouter()
	api.RegisterRoutes(router, wsHandler, chatService)

	// TODO: serve the frontend from the dist folder for production
	// fs := http.FileServer(http.Dir("./dist"))
	// router.Handle("/", fs)

	log.Println("Server started on :8080")
	if err := http.ListenAndServe(":8080", router); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
