# Feature List

## Authentication

### Backend
- [x] Login endpoint
- [x] Register endpoint
- [x] Logout endpoint
- [x] Account deletion endpoint
- [ ] Automated idle account cleanup service
- [ ] Password reset endpoints
- [ ] Password change endpoint

### Frontend
- [x] Login form & validation
- [x] Registration form & validation
- [x] Logout functionality
- [ ] Account settings page
- [ ] Password reset flow
- [ ] Password change form

## Real-time Chat

### Backend
- [x] WebSocket message handling
- [x] Message persistence in database
- [ ] Message deletion endpoints
- [ ] Message edit endpoints
- [ ] Message history pagination
- [ ] Message reaction system
- [ ] Session Redis persistence for message history
- [x] Message queue/buffer postgres persistence //TODO: Tune values for production
- [ ] User status (online/idle/offline, etc) Redis persistence

### Frontend
- [x] Message sending UI
- [x] Real-time message reception
- [ ] Message deletion UI
- [ ] Message editing UI
- [ ] Message history infinite scroll
- [ ] Reaction picker UI

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
- [ ] Image deletion cleanup

### Frontend
- [x] Image upload UI
- [x] Image preview modal // TODO: Make Modal window hook
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
- [ ] Video player modal
- [ ] Video thumbnail display
- [ ] Video download button

## Audio Attachments

### Backend
- [ ] Audio upload handling
- [ ] Audio format validation
- [ ] Audio streaming endpoints

### Frontend
- [ ] Audio upload UI
- [ ] Audio player component
- [ ] Audio download button

## Real-time Sketchpad

### Backend
- [ ] WebSocket drawing events
- [ ] Drawing state persistence
- [ ] Drawing history service

### Frontend
- [ ] Canvas drawing implementation
- [ ] Drawing tools (pen, eraser)
- [ ] Undo/Redo functionality
- [ ] Drawing download
- [ ] Clear canvas function

## Infrastructure Improvements

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