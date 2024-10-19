package main

import (
	"log"
	"net/http"
	"os"

	"rtc-nb/backend/chat"
	"rtc-nb/backend/config"
)

func main() {

	// Load environment variables from config file (and .env)
	config.LoadEnv()

	// Start the Redis client
	redisClient := chat.NewRedisClient(os.Getenv("REDIS_SERVER"))

	// Create a new chat server
	cs := chat.NewChatServer(redisClient)

	// Set up WebSocket route
	http.HandleFunc("/ws", cs.HandleWebSocket)

	// Start the HTTP server
	log.Println("Server started on :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
