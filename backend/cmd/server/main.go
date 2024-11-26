package main

import (
	"log"
	"net/http"
	"os"

	"rtc-nb/backend/chat"
	"rtc-nb/backend/internal/config"
	"rtc-nb/backend/internal/store/database"
	"rtc-nb/backend/internal/store/redis"
	"rtc-nb/backend/pkg/api"
	"rtc-nb/backend/websocket"
)

func main() {

	cfg := config.Load()

	store := database.NewStore()
	db, err := store.Open()
	if err != nil {
		log.Fatal(err)
	}
	defer store.Close()

	redisStore := redis.NewStore(cfg.Redis)

	chatService := chat.NewService(
		store.NewStore(db),
		redis.NewBroker(os.Getenv("REDIS_SERVER")),
		chat.NewStateManager(500), // TODO: make this configurable
	)

	wsHandler := websocket.NewWebSocketHandler(chatService)

	// webSocketHandler := websocketmanager.NewWebSocketHandler(redisClient, connectionManager)

	router := http.NewServeMux()
	api.RegisterRoutes(router, wsHandler, chatService)

	// TODO: serve the frontend from the dist folder for production
	// fs := http.FileServer(http.Dir("./dist"))
	// router.Handle("/", fs)

	log.Println("Server started on :8080")
	if err := http.ListenAndServe(":8080", router); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
