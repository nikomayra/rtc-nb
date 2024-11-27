package database

import (
	"fmt"
	"reflect"
	"rtc-nb/backend/internal/models"
	"strings"
	"testing"
)

const (
	greenCheck = "\u2713"
	redX       = "\u2717"
)

// TestUserStructAlignment verifies User model matches database schema
func TestUserStructAlignment(t *testing.T) {
	expectedFields := map[string]string{
		"username":        "string",
		"hashed_password": "string",
		"is_online":       "bool",
		"created_at":      "time.Time",
		"last_seen":       "time.Time",
	}

	userType := reflect.TypeOf(models.User{})
	actualFields := make(map[string]string)

	// Extract fields from struct
	for i := 0; i < userType.NumField(); i++ {
		field := userType.Field(i)
		fieldName := field.Tag.Get("json")
		if fieldName == "-" {
			// For fields marked with json:"-", use the struct field name instead
			fieldName = toSnakeCase(field.Name)
		} else if fieldName != "" {
			fieldName = strings.Split(fieldName, ",")[0]
		} else {
			fieldName = toSnakeCase(field.Name)
		}
		actualFields[fieldName] = field.Type.String()
	}

	t.Log("\nTesting User Struct Alignment:")
	for dbField, dbType := range expectedFields {
		if actualType, exists := actualFields[dbField]; !exists {
			t.Errorf("\t%s Field %s: missing from struct", redX, dbField)
		} else if !isCompatibleType(dbType, actualType) {
			t.Errorf("\t%s Field %s: type mismatch (expected %s, got %s)", redX, dbField, dbType, actualType)
		} else {
			t.Logf("\t%s Field %s: matches expected type %s", greenCheck, dbField, dbType)
		}
	}
}

// TestChannelStructAlignment verifies Channel model matches database schema
func TestChannelStructAlignment(t *testing.T) {
	expectedFields := map[string]string{
		"name":            "string",
		"is_private":      "bool",
		"description":     "*string",
		"hashed_password": "*string",
		"created_by":      "string",
		"created_at":      "time.Time",
	}

	channelType := reflect.TypeOf(models.Channel{})
	actualFields := make(map[string]string)

	// Extract fields from struct
	for i := 0; i < channelType.NumField(); i++ {
		field := channelType.Field(i)
		fieldName := field.Tag.Get("json")
		if fieldName == "-" {
			// For fields marked with json:"-", use the struct field name instead
			fieldName = toSnakeCase(field.Name)
		} else if fieldName != "" {
			fieldName = strings.Split(fieldName, ",")[0]
		} else {
			fieldName = toSnakeCase(field.Name)
		}
		actualFields[fieldName] = field.Type.String()
	}

	t.Log("\nTesting Channel Struct Alignment:")
	for dbField, dbType := range expectedFields {
		if actualType, exists := actualFields[dbField]; !exists {
			t.Errorf("\t%s Field %s: missing from struct", redX, dbField)
		} else if !isCompatibleType(dbType, actualType) {
			t.Errorf("\t%s Field %s: type mismatch (expected %s, got %s)", redX, dbField, dbType, actualType)
		} else {
			t.Logf("\t%s Field %s: matches expected type %s", greenCheck, dbField, dbType)
		}
	}
}

// TestChannelMemberStructAlignment verifies ChannelMember model matches database schema
func TestChannelMemberStructAlignment(t *testing.T) {
	expectedFields := map[string]string{
		"username":     "string",
		"is_admin":     "bool",
		"joined_at":    "time.Time",
		"last_message": "time.Time",
	}

	memberType := reflect.TypeOf(models.ChannelMember{})
	actualFields := make(map[string]string)

	for i := 0; i < memberType.NumField(); i++ {
		field := memberType.Field(i)
		if field.Tag.Get("json") == "-" {
			continue
		}
		fieldName := field.Tag.Get("json")
		if fieldName == "" {
			fieldName = toSnakeCase(field.Name)
		} else {
			fieldName = strings.Split(fieldName, ",")[0]
		}
		if fieldName != "-" {
			actualFields[toSnakeCase(fieldName)] = field.Type.String()
		}
	}

	for dbField, dbType := range expectedFields {
		if actualType, exists := actualFields[dbField]; !exists {
			t.Errorf("Missing field in ChannelMember struct: %s", dbField)
		} else if !isCompatibleType(dbType, actualType) {
			t.Errorf("Type mismatch for %s: expected %s, got %s", dbField, dbType, actualType)
		} else {
			t.Logf("✓ Field %s matches expected type %s", dbField, dbType)
		}
	}
}

// TestPreparedStatements verifies SQL statements match schema
func TestPreparedStatements(t *testing.T) {
	tests := []struct {
		name           string
		statement      string
		expectedFields []string
		table          string
	}{
		// User statements
		{
			name:           "InsertUser",
			statement:      `INSERT INTO users (username, hashed_password)`,
			expectedFields: []string{"username", "hashed_password"},
			table:          "users",
		},
		{
			name:           "SelectUser",
			statement:      `SELECT username, hashed_password, created_at, last_seen`,
			expectedFields: []string{"username", "hashed_password", "created_at", "last_seen"},
			table:          "users",
		},
		{
			name:           "UpdateUser",
			statement:      `UPDATE users SET hashed_password = $2, last_seen = CURRENT_TIMESTAMP`,
			expectedFields: []string{"hashed_password", "last_seen"},
			table:          "users",
		},
		// User status statements
		{
			name:           "UpsertUserStatus",
			statement:      `INSERT INTO user_status (username, is_online, last_seen)`,
			expectedFields: []string{"username", "is_online", "last_seen"},
			table:          "user_status",
		},
		// Channel statements
		{
			name:           "InsertChannel",
			statement:      `INSERT INTO channels (name, is_private, description, hashed_password, created_by)`,
			expectedFields: []string{"name", "is_private", "description", "hashed_password", "created_by"},
			table:          "channels",
		},
		{
			name:           "SelectChannel",
			statement:      `SELECT name, is_private, description, created_by, created_at`,
			expectedFields: []string{"name", "is_private", "description", "created_by", "created_at"},
			table:          "channels",
		},
		// Channel member statements
		{
			name:           "SelectChannelMembers",
			statement:      `SELECT username, is_admin, joined_at, last_message`,
			expectedFields: []string{"username", "is_admin", "joined_at", "last_message"},
			table:          "channel_member",
		},
		// Message statements
		{
			name:           "InsertMessage",
			statement:      `INSERT INTO messages (id, channel_name, username, message_type, content)`,
			expectedFields: []string{"id", "channel_name", "username", "message_type", "content"},
			table:          "messages",
		},
		{
			name:           "SelectMessages",
			statement:      `SELECT id, channel_name, username, message_type, content, timestamp`,
			expectedFields: []string{"id", "channel_name", "username", "message_type", "content", "timestamp"},
			table:          "messages",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fields := extractFields(tt.statement)

			// Debug output
			t.Logf("Statement: %s", tt.statement)
			t.Logf("Extracted fields: %v", fields)
			t.Logf("Expected fields: %v", tt.expectedFields)

			if !reflect.DeepEqual(fields, tt.expectedFields) {
				t.Errorf("Statement field mismatch for %s\nExpected: %v\nGot: %v",
					tt.name, tt.expectedFields, fields)
			} else {
				t.Logf("✓ Field %s matches expected type %s", tt.name, tt.table)
			}
		})
	}
}

// TestStatementParameterCount verifies parameter count matches fields
func TestStatementParameterCount(t *testing.T) {
	tests := []struct {
		name           string
		statement      string
		expectedParams int
	}{
		{"InsertUser", `VALUES ($1, $2)`, 2},
		{"SelectUser", `WHERE username = $1`, 1},
		{"UpdateUser", `SET hashed_password = $2, last_seen = CURRENT_TIMESTAMP WHERE username = $1`, 2},
		{"InsertChannel", `VALUES ($1, $2, $3, $4, $5)`, 5},
		{"AddChannelMember", `VALUES ($1, $2, $3)`, 3},
		{"InsertMessage", `VALUES ($1, $2, $3, $4, $5)`, 5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			params := countParameters(tt.statement)
			if params != tt.expectedParams {
				t.Errorf("Parameter count mismatch for %s\nExpected: %d\nGot: %d",
					tt.name, tt.expectedParams, params)
			} else {
				t.Logf("✓ Field %s matches expected type %d", tt.name, tt.expectedParams)
			}
		})
	}
}

// Helper function to count SQL parameters ($1, $2, etc.)
func countParameters(statement string) int {
	count := 0
	for i := 1; i <= 9; i++ { // Assuming max 9 parameters
		if strings.Contains(statement, fmt.Sprintf("$%d", i)) {
			count++
		}
	}
	return count
}

// Helper functions
func toSnakeCase(s string) string {
	var result strings.Builder
	for i, r := range s {
		if i > 0 && r >= 'A' && r <= 'Z' {
			result.WriteRune('_')
		}
		result.WriteRune(r)
	}
	return strings.ToLower(result.String())
}

func isCompatibleType(dbType, structType string) bool {
	typeMap := map[string][]string{
		"string":                    {"string"},
		"*string":                   {"*string"},
		"bool":                      {"bool"},
		"time.Time":                 {"time.Time"},
		"*time.Time":                {"*time.Time"},
		"int":                       {"int", "int32", "int64", "MessageType"},
		"interface{}":               {"MessageContent"},
		"map[string]*ChannelMember": {"map[string]*models.ChannelMember"},
	}
	validTypes, exists := typeMap[dbType]
	if !exists {
		return false
	}
	for _, t := range validTypes {
		if strings.HasSuffix(structType, t) {
			return true
		}
	}
	return false
}

func extractFields(statement string) []string {
	var raw string
	if strings.HasPrefix(strings.TrimSpace(statement), "SELECT") {
		parts := strings.Split(statement, "FROM")
		raw = strings.TrimPrefix(parts[0], "SELECT")
	} else if strings.HasPrefix(strings.TrimSpace(statement), "INSERT") {
		start := strings.Index(statement, "(")
		end := strings.Index(statement, ")")
		if start != -1 && end != -1 {
			raw = statement[start+1 : end]
		}
	} else if strings.HasPrefix(strings.TrimSpace(statement), "UPDATE") {
		parts := strings.Split(statement, "SET")
		if len(parts) > 1 {
			whereParts := strings.Split(parts[1], "WHERE")
			raw = whereParts[0]
		}
	}

	fields := strings.Split(raw, ",")
	result := make([]string, 0, len(fields))
	for _, f := range fields {
		f = strings.TrimSpace(f)
		if f == "" {
			continue
		}
		if strings.Contains(f, "=") {
			f = strings.Split(f, "=")[0]
		}
		f = strings.TrimSpace(f)
		if f != "" {
			result = append(result, f)
		}
	}
	return result
}
