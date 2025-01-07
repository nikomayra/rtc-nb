# Feature List

## Authentication

### Backend

- [x] Login endpoint
- [x] Register endpoint
- [x] Logout endpoint
- [x] Account deletion endpoint
- [ ] Automated idle account cleanup service

### Frontend

- [x] Login form & validation
- [x] Registration form & validation
- [x] Logout functionality

## Real-time Chat

### Backend

- [x] WebSocket message handling
- [x] Message persistence in database
- [x] Message queue/buffer postgres persistence //TODO: Tune values for production
- [ ] User status (online/idle/offline, etc)

### Frontend

- [x] Message sending UI
- [x] Real-time message reception

## File Management

### Backend

- [x] File upload validation service
- [x] Content-type verification
- [ ] File cleanup service
- [ ] Rate limiting middleware
- [ ] File download endpoints

### Shared

- [x] File size constraints
- [x] Supported format definitions
- [ ] Rate limit configurations

## Image Attachments

### Backend

- [x] Image upload handling
- [x] Thumbnail generation service
- [x] Image serving endpoints
- [ ] Image 'idle' deletion cleanup

### Frontend

- [x] Image upload UI
- [x] Image preview modal
- [ ] Image download button
- [x] Thumbnail display in chat

## Video Attachments

### Backend

- [ ] Video upload handling
- [ ] Video thumbnail generation
- [ ] Video streaming endpoints
- [ ] Video format validation

### Frontend

- [ ] Video upload UI
- [x] Video player modal
- [ ] Video thumbnail display
- [ ] Video download button

## Real-time Sketchpad

### Backend

- [x] Sketchpad creation endpoint
- [x] Sketchpad deletion endpoint
- [x] Sketchpad get endpoints
- [x] Sketch data structures
- [x] Sketch buffer for sketch messages
- [x] WebSocket drawing events
- [x] Drawing state persistence
- [ ] Clear canvas route

### Frontend

- [x] Canvas drawing implementation
- [x] Drawing tools (pen, eraser)
- [x] Drawing download
- [ ] Clear canvas function

## Infrastructure & Future Improvements

### Feature Specific

- [ ] Undo/Redo functionality on sketch
- [ ] Drawing history service
- [ ] Password reset endpoints
- [ ] Password change endpoint
- [ ] Account settings page
- [ ] Password reset flow
- [ ] Password change form
- [ ] Message deletion UI
- [ ] Message editing UI
- [ ] Message history infinite scroll
- [ ] Reaction picker UI
- [ ] Message deletion endpoints
- [ ] Message edit endpoints
- [ ] Message history pagination
- [ ] Message reaction system

### Logging & Monitoring

- [ ] Implement structured logging (slog)
- [ ] Request tracing system
- [ ] Error monitoring
- [ ] Performance metrics

### Context Implementation

- [ ] Request tracing context
- [ ] User preferences context
- [ ] Rate limiting context
- [ ] Channel settings context

### Security

- [ ] Rate limiting implementation
- [ ] Input validation
- [ ] Security headers
- [ ] CSRF protection

## Notes

- Context values should be immutable
- Use context for cross-cutting concerns, not for business logic
- Implement proper error handling at all layers
- Consider monitoring and observability from the start
- Note in git writeup about how I'd use pubsub for a larger scale application and its
- Note in git writeup about benefits of redis cache for larger scale appliacation.
