package models

type User struct {
	Username  string `json:"username"`
	Password  string `json:"password"`
	Guess     string `json:"guess"`
	Highscore int    `json:"highscore"`
}

type Game struct {
	ActivePlayers     []string `json:"active_players"`
	EliminatedPlayers []string `json:"eliminated_players"`
	Answer            string   `json:"answer"`
	Round             int      `json:"round"`
}