package models

// Quick in-game data (redis)

// User struct definition
type User struct {
	Username  string `json:"username"`
	Password  string `json:"password"`
	Highscore int    `json:"highscore"`
	Wins      int    `json:"wins"`
	Losses    int    `json:"losses"`
	Guess      string `json:"guess"`
	Eliminated bool   `json:"eliminated"`
}

// NewUser constructor with default values
func NewUser(username, password string) *User {
    return &User{
        Username:  username,
        Password:  password,
        Highscore: 0,
        Wins:      0,
        Losses:    0,
        Guess:     "",
        Eliminated: false,
    }
}

// Game data
type Game struct {
	GameID			  string   `json:"game_id"`
	ActivePlayers     []string `json:"active_players"`
	EliminatedPlayers []string `json:"eliminated_players"`
	Answer            string   `json:"answer"`
	Round             int      `json:"round"`
	Started           bool     `json:"started"`
}