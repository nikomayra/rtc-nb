package api

import (
	"fmt"
	"rtc-nb/backend/models"
)

func checkIfUsernameUniqueInDB(username string) bool {
	// TBD Implementation
	return true
}

func addNewUserToDB(user models.User) error {
	// TBD Implementation
	return fmt.Errorf("Bad")
}

func ValidateUserPasswordInDB(username, password string) bool {
	// TBD Implementation
	return true
}