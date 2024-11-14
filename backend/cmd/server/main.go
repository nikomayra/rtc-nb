package main

import (
	"log"
	"net/http"
	"os"

	"rtc-nb/backend/api"
	"rtc-nb/backend/chat"
	"rtc-nb/backend/internal/config"
	"rtc-nb/backend/internal/database"
	"rtc-nb/backend/redis"
	"rtc-nb/backend/websocket"
	"rtc-nb/backend/websocket/connection"
)

func main() {

	config.LoadEnv()

	db := database.GetDB()
	if err := database.PrepareStatements(db); err != nil {
		log.Fatal(err)
	}
	defer database.CloseStatements()

	redisClient := redis.NewRedisClient(os.Getenv("REDIS_SERVER"))
	connectionManager := connection.NewConnectionManager()
	chatServer := chat.NewChatServer(redisClient, connectionManager)
	webSocketHandler := websocket.NewWebSocketHandler(redisClient, chatServer, connectionManager)

	newMuxRouter := http.NewServeMux()
	api.RegisterRoutes(newMuxRouter, webSocketHandler, chatServer)

	log.Println("Server started on :8080")
	if err := http.ListenAndServe(":8080", newMuxRouter); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
