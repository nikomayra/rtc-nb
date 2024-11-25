package main

import (
	"log"
	"net/http"
	"os"

	"rtc-nb/backend/api"
	"rtc-nb/backend/internal/config"
	"rtc-nb/backend/internal/database"
	"rtc-nb/backend/redismanager"
)

func main() {

	config.LoadEnv()

	db := database.GetDB()

	if err := database.PrepareStatements(db); err != nil {
		log.Fatal(err)
	}
	defer database.CloseStatements()

	redisClient := redismanager.NewRedisClient(os.Getenv("REDIS_SERVER"))
	// connectionManager := connection.NewConnectionManager()
	// chatServer := chat.NewChatServer(redisClient, connectionManager)

	chatService := chat.NewService(
		store.NewStore(db),
		redis.NewBroker(redisClient),
		chat.NewStateManager(1000),
	)

	wsHandler := websocket.NewHandler(chatService)

	// webSocketHandler := websocketmanager.NewWebSocketHandler(redisClient, connectionManager)

	router := http.NewServeMux()
	api.RegisterRoutes(router, wsHandler, chatService)

	log.Println("Server started on :8080")
	if err := http.ListenAndServe(":8080", router); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
