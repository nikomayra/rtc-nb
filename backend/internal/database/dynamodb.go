package database

import (
	"context"
	"fmt"
	"log"
	"os"

	//"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

var dbClient *dynamodb.Client

func InitDynamoDB() {
	// Load the shared AWS configuration from environment
	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion(os.Getenv("AWS_REGION")))
	if err != nil {
		log.Fatalf("unable to load SDK config, %v", err)
	}

	// Create DynamoDB client
	dbClient = dynamodb.NewFromConfig(cfg)
	fmt.Println("Successfully connected to DynamoDB")
}

// This function is just to check if the client works.
func GetDynamoDBClient() *dynamodb.Client {
	if dbClient == nil {
		InitDynamoDB()
	}
	return dbClient
}
