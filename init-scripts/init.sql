-- Basic user table - stores authentication info
CREATE TABLE users (
    username VARCHAR(50) PRIMARY KEY,
    hashed_password VARCHAR(100) NOT NULL,
    is_online BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Represents the current state of a user
CREATE TABLE user_status (
    username VARCHAR(50) PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
    is_online BOOLEAN NOT NULL DEFAULT false,
    last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Channel table - stores channel information
CREATE TABLE channels (
    name VARCHAR(50) PRIMARY KEY,
    is_private BOOLEAN NOT NULL DEFAULT false,
    description TEXT,                  -- Optional
    hashed_password VARCHAR(100),      -- Optional
    created_by VARCHAR(50) NOT NULL REFERENCES users(username),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Represents a user's status and metadata within a channel
CREATE TABLE channel_member (
    channel_name VARCHAR(50) REFERENCES channels(name) ON DELETE CASCADE,
    username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_message TIMESTAMP,
    PRIMARY KEY (channel_name, username)
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    channel_name VARCHAR(50) REFERENCES channels(name) ON DELETE CASCADE,
    username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
    message_type INTEGER NOT NULL,
    content JSONB NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Sketch table
CREATE TABLE sketches (
    id UUID PRIMARY KEY,
    channel_name VARCHAR(50) REFERENCES channels(name) ON DELETE CASCADE,
    display_name VARCHAR(50) NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    regions JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE
);

-- Indexes to speed up queries
CREATE INDEX idx_messages_channel_timestamp ON messages(channel_name, timestamp);
CREATE INDEX idx_channels_created_by ON channels(created_by);
