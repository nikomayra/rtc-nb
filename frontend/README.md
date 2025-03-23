# Frontend Architecture

## Overview

The frontend architecture follows a clean separation of concerns with a service-oriented approach. The main components are:

1. **API Layer**: Handles direct HTTP requests to the backend
2. **Services Layer**: Provides singleton services with business logic and caching
3. **Contexts**: Provide state management throughout the application
4. **Hooks**: Custom React hooks that connect services and contexts to components
5. **Components**: UI elements that consume hooks and contexts

## Architecture Layers

### 1. API Layer

Located in `src/api/`, this layer contains direct API calls to the backend.

- `chatApi.ts`: Handles REST API calls for chat-related functionality with validation using Zod
- `axiosInstance.ts`: Configures the Axios instance with interceptors and common settings

### 2. Services Layer

Located in `src/services/`, this layer implements the singleton pattern and manages:

- **State Caching**: In-memory caches for channels and messages
- **Business Logic**: Implementation of domain-specific logic
- **API Integration**: Connection between frontend and backend
- **Data Formatting**: Handles case conversion between frontend and backend formats

Key services:

- `ChatService.ts`: Manages channel operations, message fetching, and caching
- `WebSocketService.ts`: Handles WebSocket connections and message formatting

Service implementation highlights:

```typescript
// ChatService is a singleton with caching
export class ChatService {
  private static instance: ChatService;
  private cachedChannels: Channel[] | null = null;
  private channelMessagesCache: Record<string, IncomingMessage[]> = {};

  // Provides a central access point
  public static getInstance(): ChatService { ... }

  // Methods for channel/message operations with cache management
  public async fetchChannels(token: string, forceRefresh = false): Promise<Channel[]> { ... }
}
```

### 3. Context Layer

Located in `src/contexts/`, this layer provides application-wide state.

- `webSocketContext.ts`: Manages WebSocket connections state and actions
- `chatContext.ts`: Provides chat-related state and actions
- `authContext.ts`: Handles authentication state
- `notificationContext.ts`: Manages notifications

Each context follows a consistent pattern:

```typescript
export interface ChatContext {
  state: {
    /* State properties */
  };
  actions: {
    /* Actions to modify state */
  };
}
```

### 4. Hooks Layer

Located in `src/hooks/`, these custom hooks abstract away complex logic and state management.

- `useChat.ts`: Core hook that orchestrates chat functionality
  - Manages channels, messages, and WebSocket interactions
  - Implements rate limiting and error handling
  - Provides a clean API for components
- `useAuthContext.ts`: Simplifies authentication interactions
- `useNotification.ts`: Manages user notifications

The `useChat` hook is central to the implementation and follows a clear initialization flow:

1. Connects to the system WebSocket
2. Fetches available channels
3. Restores the previous channel if available
4. Fetches messages for the current channel

### 5. UI Components Layer

Located in `src/components/`, this layer contains React components that:

- Connect to hooks and contexts
- Render UI based on application state
- Handle user interactions

## Data Flow

1. **User Action**: Component captures user interaction (e.g., click on "Send Message")
2. **Hook Call**: Component calls a hook method (e.g., `chat.actions.sendMessage`)
3. **Service Execution**: Hook delegates to the appropriate service (e.g., `WebSocketService.send`)
4. **Message Formatting**: Service converts message format (camelCase to snake_case)
5. **WebSocket Send**: Formatted message sent through appropriate socket
6. **Backend Processing**: Server processes message and broadcasts to relevant clients
7. **Message Receipt**: WebSocket service receives message and converts format (snake_case to camelCase)
8. **State Update**: Hook updates state based on received message
9. **Re-render**: Components receive updated state and re-render

### WebSocket Architecture

The WebSocket implementation follows a clear separation of concerns:

1. **Socket Types**:

   - **System Socket**: Only handles channel creation/deletion updates
   - **Channel Socket**: Handles all channel-specific messages (text, image, sketch, member updates, user status)

2. **Message Flow**:

   ```typescript
   // Outgoing message flow
   Component -> Hook -> WebSocketService.send() -> convertKeysToSnakeCase() -> WebSocket

   // Incoming message flow
   WebSocket -> handleIncomingMessage() -> convertKeysToCamelCase() -> MessageHandler -> State Update
   ```

3. **Message Types**:

   - Channel Socket Messages:
     - Text messages
     - Image messages
     - Sketch messages
     - Member updates (join/leave/role changes)
     - User status updates
   - System Socket Messages:
     - Channel creation
     - Channel deletion

4. **Case Conversion**:

   - Frontend uses camelCase (e.g., `channelName`)
   - Backend uses snake_case (e.g., `channel_name`)
   - Automatic conversion in WebSocketService:

     ```typescript
     // Sending
     const snakeCaseMessage = convertKeysToSnakeCase(message);
     socket.send(JSON.stringify(snakeCaseMessage));

     // Receiving
     const rawMessage = JSON.parse(event.data);
     const message = convertKeysToCamelCase(rawMessage);
     ```

5. **Connection Management**:
   - Automatic reconnection with retry limits
   - Connection state tracking
   - Clean disconnection handling

## Error Handling

The architecture implements centralized error handling:

- **API Errors**: Captured in the service layer
- **WebSocket Errors**: Handled with reconnection logic
- **Message Parsing Errors**: Safely caught and logged
- **State Management**: Error state propagated through contexts

## Best Practices

1. **Singleton Services**: Use of singleton pattern for services
2. **Clear Message Routing**: Each message type has a defined path
3. **Consistent Case Handling**: Automatic case conversion at service boundaries
4. **Type Safety**: Comprehensive TypeScript types for all messages
5. **Error Boundaries**: Proper error handling at each layer
6. **Clean Disconnection**: Proper cleanup of WebSocket connections
7. **State Consistency**: Immediate UI updates with proper error handling

## Future Improvements

- Add more comprehensive unit tests for services and hooks
- Implement optimistic UI updates for better user experience
- Add service worker for offline capability
- Improve WebSocket reconnection logic with exponential backoff
- Implement client-side encryption for private messages
