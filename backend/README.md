# Backend Architecture

## Overview

The backend architecture follows a structured, layered approach with clear separation of concerns. It's built in Go with a modular design focused on maintainability and scalability. The main components are:

1. **HTTP API Layer**: RESTful endpoints for client interactions
2. **WebSocket Layer**: Real-time bi-directional communication
3. **Service Layer**: Core business logic and domain operations
4. **Data Model Layer**: Type definitions and validation logic
5. **Store Layer**: Database and file storage abstraction
6. **Connection Management**: WebSocket connection handling

## Architecture Diagram

```mermaid
flowchart TD
    Client[Client] --> API[API Gateway \n\n HTTP Handlers | WebSocket Handlers]

    subgraph AuthLayer[Authentication Layer]
        JWT[JWT Token Validation]
    end

    API --> AuthLayer

    subgraph ServiceLayer[Service Layer]
        ChatSvc[Chat Service]
        UserSvc[User Service]
        SketchSvc[Sketch Service]
    end

    AuthLayer --> ServiceLayer

    subgraph DataLayer[Data Access Layer]
        ChannelStore[Channel Store]
        UserStore[User Store]
        MessageStore[Message Store]
    end

    ChatSvc --> ChannelStore
    ChatSvc --> MessageStore
    UserSvc --> UserStore
    SketchSvc --> MessageStore

    ChannelStore --> DB[(PostgreSQL)]
    UserStore --> DB
    MessageStore --> DB

    subgraph ConnectionMgmt[Connection Management]
        Conn[WebSocket Connections]
    end

    API <--> ConnectionMgmt
    ServiceLayer <--> ConnectionMgmt
```

## Architecture Layers

### 1. HTTP API Layer

Located in `pkg/api/handlers/`, this layer handles all HTTP requests and responses.

- `handlers.go`: Contains route handlers for authentication, channels, messages, and file operations
- RESTful endpoint design with consistent error handling and response formatting
- JWT-based authentication using middleware

Key endpoints include:

```go
// Authentication
func (h *Handlers) RegisterHandler(w http.ResponseWriter, r *http.Request)
func (h *Handlers) LoginHandler(w http.ResponseWriter, r *http.Request)
func (h *Handlers) LogoutHandler(w http.ResponseWriter, r *http.Request)

// Channel operations
func (h *Handlers) CreateChannelHandler(w http.ResponseWriter, r *http.Request)
func (h *Handlers) JoinChannelHandler(w http.ResponseWriter, r *http.Request)
func (h *Handlers) LeaveChannelHandler(w http.ResponseWriter, r *http.Request)
func (h *Handlers) GetChannelsHandler(w http.ResponseWriter, r *http.Request)
func (h *Handlers) DeleteChannelHandler(w http.ResponseWriter, r *http.Request)
```

Response handling is standardized through the `responses` package.

### 2. WebSocket Layer

Located in `internal/websocket/`, this layer manages real-time communication.

- `handler.go`: Handles upgrading HTTP connections to WebSockets and routing messages
- User and channel-specific message handling
- Connection lifecycle management

Key components:

```go
// WebSocket handler
func (h *Handler) HandleChannelWebSocket(w http.ResponseWriter, r *http.Request)
func (h *Handler) HandleSystemWebSocket(w http.ResponseWriter, r *http.Request)

// WebSocket message processing
func (p *Processor) ProcessMessage(msg *models.Message) error
```

### 3. Service Layer

Located in `internal/services/`, this layer contains core business logic.

Key services:

- `chat/service.go`: Manages chat functionality (channels, messages)
- `sketch/service.go`: Handles collaborative sketching features

Service interfaces ensure loose coupling between components:

```go
type ChatService interface {
    CreateChannel(ctx context.Context, name, creator string, description, password *string) (*models.Channel, error)
    GetChannel(ctx context.Context, name string) (*models.Channel, error)
    // ...other methods
}
```

### 4. Data Model Layer

Located in `internal/models/`, this layer defines data structures and validation logic.

- `user.go`: User account data and methods
- `channel.go`: Chat channel data and methods
- `message.go`: Message types and content structures
- `sketch.go`: Sketch data models for collaborative drawing

Each model contains its own validation methods:

```go
func (c *Channel) Validate() error {
    if c.Name == "" {
        return ErrEmptyChannelName
    }
    // ...other validation
}
```

### 5. Store Layer

Located in `internal/store/`, this layer handles data persistence.

- `database/postgres.go`: PostgreSQL implementation
- `database/statements.go`: SQL statement preparation
- `filestore/`: File storage for image attachments

Database operations are abstracted through interfaces:

```go
type Store interface {
    CreateUser(ctx context.Context, user *models.User) error
    GetUser(ctx context.Context, username string) (*models.User, error)
    // ...other methods
}
```

### 6. Connection Management

Located in `internal/connections/`, this layer manages active WebSocket connections.

- Handles user presence tracking
- Routes messages to appropriate clients
- Provides channel subscription capabilities

## Data Flow

1. A client connects to the server via HTTP or WebSocket
2. Authentication middleware validates the request
3. The request is routed to the appropriate handler
4. The handler calls the relevant service
5. The service performs business logic and interacts with the store layer
6. For real-time updates, messages are broadcast to connected clients

## Configuration

Application configuration is managed in `internal/config/config.go`, which:

- Loads environment variables
- Establishes database connections
- Configures file storage paths

## Testing

The backend includes several test types:

- Unit tests for core business logic
- Schema tests that validate model-to-database alignment
- Integration tests for API endpoints

Schema tests can be run with:

```
cd backend
go test ./internal/store/database -v
```

## Future Improvements

1. **Query Optimization**: Add query caching and optimization for frequently accessed data
2. **Caching Layer**: Introduce caching for frequently accessed data
3. **Microservices**: Consider splitting into microservices for certain features
4. **Metrics & Monitoring**: Add detailed metrics and monitoring
5. **Rate Limiting**: Implement rate limiting for API endpoints
