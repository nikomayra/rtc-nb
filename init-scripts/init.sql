-- Basic user table - stores authentication info
CREATE TABLE users (
    username VARCHAR(50) PRIMARY KEY,  -- Limited to 50 chars, must be unique
    hashed_password VARCHAR(100) NOT NULL  -- Store hashed password, never plaintext
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Represents the current state of a user
CREATE TABLE user_status (
    username VARCHAR(50) PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
    is_online BOOLEAN NOT NULL DEFAULT false,
    last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- type User struct {
-- 	Username       string    `json:"username"`
-- 	HashedPassword string    `json:"-"` // Never expose in JSON
-- 	CreatedAt      time.Time `json:"createdAt"`
-- 	LastSeen       time.Time `json:"lastSeen"`
-- }

-- // Represents the current state of a user
-- type UserStatus struct {
-- 	Username string    `json:"username"`
-- 	IsOnline bool      `json:"isOnline"`
-- 	LastSeen time.Time `json:"lastSeen"`
-- }

-- Channel table - stores channel information
CREATE TABLE channels (
    name VARCHAR(50) PRIMARY KEY,  -- Channel names must be unique
    hashed_password VARCHAR(100),    -- Optional password for private channels
    is_private BOOLEAN NOT NULL DEFAULT false,
    description TEXT,             -- TEXT has no length limit, unlike VARCHAR
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
);

-- Represents a user's status and metadata within a channel
CREATE TABLE channel_member (
    username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_message TIMESTAMP
);

-- type Channel struct {
-- 	Name           string    `json:"name"`
-- 	IsPrivate      bool      `json:"isPrivate"`
-- 	Description    *string   `json:"description,omitempty"`
-- 	HashedPassword *string   `json:"-"` // Never expose in JSON
-- 	CreatedAt      time.Time `json:"createdAt"`

-- 	mu      sync.RWMutex              `json:"-"`
-- 	Members map[string]*ChannelMember `json:"members"` // username -> member data
-- }

-- // Represents a user's status and metadata within a channel
-- type ChannelMember struct {
-- 	Username    string     `json:"username"`
-- 	IsAdmin     bool       `json:"isAdmin"`
-- 	JoinedAt    time.Time  `json:"joinedAt"`
-- 	LastMessage *time.Time `json:"lastMessage,omitempty"`
-- }

CREATE TABLE messages (
    id UUID PRIMARY KEY,
    channel_name VARCHAR(50) REFERENCES channels(name) ON DELETE CASCADE,
    username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
    message_type INTEGER NOT NULL,
    content JSONB NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Message
-- ID          string         `json:"id"`
-- ChannelName string         `json:"channelName"`
-- Username    string         `json:"username"`
-- Type        MessageType    `json:"type"`
-- Content     MessageContent `json:"content"`
-- Timestamp   time.Time      `json:"timestamp"`


-- Index to make it faster to find messages in a channel ordered by time
CREATE INDEX idx_messages_channel_timestamp ON messages(channel_name, timestamp);

