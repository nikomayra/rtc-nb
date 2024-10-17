package main

import (
	"log"
	"net/http"

	"rtc-nb/backend/chat"
)

func main() {
	// Start the Redis client
	redisClient := chat.NewRedisClient("redis://localhost:6379") // Adjust your Redis URL

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
