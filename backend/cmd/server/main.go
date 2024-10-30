package main

import (
	"log"
	"net/http"

	"rtc-nb/backend/api"
	"rtc-nb/backend/internal/config"
	"rtc-nb/backend/internal/database"
)

func main() {

	// Load environment variables from config file (and .env)
	config.LoadEnv()

	// Initial database
	database.InitDynamoDB()

	// Start the Redis client
	// redisClient := chat.NewRedisClient(os.Getenv("REDIS_SERVER"))

	// // Create a new chat server
	// cs := chat.NewChatServer(redisClient)

	// // Set up WebSocket route
	// http.HandleFunc("/ws", cs.HandleWebSocket)

	// Create new mux router
	newMuxRouter := http.NewServeMux()

	// Register api routes
	api.RegisterRoutes(newMuxRouter)

	// Default route
	newMuxRouter.HandleFunc("/", api.DefaultRoute)

	// Start the HTTP server
	log.Println("Server started on :8080")
	if err := http.ListenAndServe(":8080", newMuxRouter); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
