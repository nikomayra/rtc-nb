package config

import (
	"bufio"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	_ "github.com/lib/pq"
)

// Loads env variables & initializes db
type Config struct {
	DB            *sql.DB
	FileStorePath string
}

func Load() *Config {
	LoadEnv()

	return &Config{
		DB:            initPostgres(),
		FileStorePath: os.Getenv("FILESTORE_PATH"),
	}
}

func initPostgres() *sql.DB {
	connStr := os.Getenv("DATABASE_URL") // Use DATABASE_URL first
	if connStr == "" {
		// Fallback for local development using individual variables
		log.Println("DATABASE_URL not found, falling back to individual POSTGRES_* variables")
		connStr = fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
			os.Getenv("POSTGRES_HOST"),
			os.Getenv("POSTGRES_PORT"),
			os.Getenv("POSTGRES_USER"),
			os.Getenv("POSTGRES_PASSWORD"),
			os.Getenv("POSTGRES_DB"),
		)
	}

	var err error
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL: %v", err)
	}
	err = db.Ping()
	if err != nil {
		log.Fatalf("Error connecting to the database: %v", err)
	}
	log.Println("Successfully connected to PostgreSQL")
	return db
}

// LoadEnv reads a .env file and sets environment variables
func LoadEnv() {
	// Determine the absolute path to the root directory's .env file
	rootDir, err := findProjectRoot()
	if err != nil {
		log.Println("Failed to find project root:", err)
		return
	}

	envPath := filepath.Join(rootDir, ".env")
	file, err := os.Open(envPath)
	if err != nil {
		log.Println("Failed to open .env file, relying on system environment variables")
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.TrimSpace(line) == "" || strings.HasPrefix(line, "#") {
			continue // Skip comments and empty lines
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			log.Printf("Config Loading...Name: %s", parts[0])
			os.Setenv(parts[0], parts[1]) // Set env var
		}
	}

	if err := scanner.Err(); err != nil {
		log.Println("Error reading .env file:", err)
	}
}

// findProjectRoot finds the root of the project by looking for a .git or .env file
func findProjectRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}

	for {
		if fileExists(filepath.Join(dir, ".git")) || fileExists(filepath.Join(dir, ".env")) {
			return dir, nil
		}

		parentDir := filepath.Dir(dir)
		if parentDir == dir { // Reached root without finding the file
			break
		}
		dir = parentDir
	}
	return "", os.ErrNotExist
}

// fileExists checks if a file exists at the given path
func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
