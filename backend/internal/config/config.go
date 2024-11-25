package config

import (
	"bufio"
	"context"
	"database/sql"
	"log"
	"os"
	"path/filepath"
	"strings"

	_ "github.com/lib/pq"
	goRedis "github.com/redis/go-redis/v9"
)

var ctx = context.Background()

type Config struct {
	DB    *sql.DB
	Redis *goRedis.Client
}

func Load() *Config {
	LoadEnv()

	return &Config{
		DB:    initPostgres(),
		Redis: initRedis(),
	}
}

func initPostgres() *sql.DB {
	dsn := os.Getenv("POSTGRES_DSN")

	var err error
	db, err := sql.Open("postgres", dsn)
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

func initRedis() *goRedis.Client {
	addr := os.Getenv("REDIS_ADDR")
	opts, err := goRedis.ParseURL(addr)
	if err != nil {
		log.Println(err)
	}
	rdb := goRedis.NewClient(opts)
	err = rdb.Ping(ctx).Err()
	if err != nil {
		log.Fatalf("Error connecting to Redis: %v", err)
	}
	log.Println("Successfully connected to Redis")
	return rdb
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

// func LoadEnv() {
//     rootDir := filepath.Join("..") // Assuming you're running from 'backend'
//     envPath := filepath.Join(rootDir, ".env")

//     file, err := os.Open(envPath)
//     if err != nil {
//         log.Println("Failed to open .env file, relying on system environment variables:", err)
//         return
//     }
//     defer file.Close()

//     scanner := bufio.NewScanner(file)
//     for scanner.Scan() {
//         line := scanner.Text()
//         if strings.TrimSpace(line) == "" || strings.HasPrefix(line, "#") {
//             continue
//         }
//         parts := strings.SplitN(line, "=", 2)
//         if len(parts) == 2 {
//             os.Setenv(parts[0], parts[1])
//         }
//     }

//     if err := scanner.Err(); err != nil {
//         log.Println("Error reading .env file:", err)
//     }
// }
