package database

import (
	"context"
	"fmt"
	"log"
	"rtc-nb/backend/internal/models"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

const UsersTable = "UsersTable"

// AddNewUser adds a new user record to DynamoDB
func AddNewUser(user *models.User) error {
	// Convert Go struct to DynamoDB attributes
	item, err := attributevalue.MarshalMap(user)
	if err != nil {
		return fmt.Errorf("failed to marshal user: %w", err)
	}
	// Put the item into the DB table
	_, err = dbClient.PutItem(context.TODO(), &dynamodb.PutItemInput{
		TableName: aws.String(UsersTable),
		Item: item,
	})
	if err != nil {
		return fmt.Errorf("failed to put item in DynamoDB: %w", err)
	}

	log.Println("Successfully added user to DynamoDB")
	return nil
}

// Fetches a user record from DynamoDB by their username
func GetUserByUsername(username string) (*models.User, error) {
	// Define the key to retrieve user
	key := map[string]types.AttributeValue{
		"Username": &types.AttributeValueMemberS{Value: username},
	}

	// Get the user from DynamoDB
	result, err := dbClient.GetItem(context.TODO(), &dynamodb.GetItemInput{
		TableName: aws.String(UsersTable),
		Key:       key,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get item from DynamoDB: %w", err)
	}

	// Convert the result to Go struct
	var user models.User
	err = attributevalue.UnmarshalMap(result.Item, &user)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal result: %w", err)
	}

	if user.Username == "" {
		return nil, fmt.Errorf("user not found")
	}

	log.Println("Successfully fetched user from DynamoDB")
	return &user, nil
}


