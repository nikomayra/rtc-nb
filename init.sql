-- Basic user table - stores authentication info
CREATE TABLE users (
    username VARCHAR(50) PRIMARY KEY,  -- Limited to 50 chars, must be unique
    password_hash VARCHAR(100) NOT NULL  -- Store hashed password, never plaintext
);

-- Channel table - stores channel information
CREATE TABLE channels (
    name VARCHAR(50) PRIMARY KEY,  -- Channel names must be unique
    password_hash VARCHAR(100),    -- Optional password for private channels
    description TEXT,             -- TEXT has no length limit, unlike VARCHAR
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- This table tracks which users are in which channels
-- Since one user can only be in one channel, we can simplify from my previous version:
CREATE TABLE channel_members (
    channel_name VARCHAR(50) REFERENCES channels(name) ON DELETE CASCADE,
    username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Ensure each user is only in one channel:
    PRIMARY KEY (username)  -- Changed from previous version to enforce one channel per user
);

CREATE TABLE messages (
    id UUID PRIMARY KEY,
    channel_name VARCHAR(50) REFERENCES channels(name) ON DELETE CASCADE,
    username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
    message_type INTEGER NOT NULL,
    content JSONB NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index to make it faster to find messages in a channel ordered by time
CREATE INDEX idx_messages_channel_timestamp ON messages(channel_name, timestamp);