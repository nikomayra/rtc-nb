package api

// Route definitions for lobby management and game actions

import (
	"github.com/gorilla/mux"
)

func RegisterRoutes(r *mux.Router) {
    r.HandleFunc("/register", register).Methods("POST")
    r.HandleFunc("/login", login).Methods("POST")
    //r.HandleFunc("/game/state", authMiddleware(getGameStateHandler)).Methods("GET")
}