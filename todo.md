# Base feature list:

## Authentication:

- [x] Login
- [x] Register
- [x] Logout
- [ ] Idle Account Deletion
- [ ] Delete account

## Real-time chat:

- [x] Send message
- [x] Receive message
- [ ] Delete message (All/Self)
- [ ] Edit message (Self)

## Uploads (General):

- [ ] Content-type validation
- [ ] File size limits
- [ ] File cleanup (unused/idle)
- [ ] Rate-limiting

## Image Attachments:

- [ ] Upload image
- [ ] Generate thumbnail
- [ ] Download image
- [ ] View image (modal)

## Video Attachments:

- [ ] Upload video
- [ ] Generate thumbnail
- [ ] Download video
- [ ] View video (modal)

## Audio Attachments:

- [ ] Upload audio
- [ ] Download audio
- [ ] Play audio (in-chat)

## Real-time Sketchpad:

- [ ] Draw
- [ ] Erase
- [ ] Undo
- [ ] Redo
- [ ] Save
- [ ] Download
- [ ] Clear

## Extras:

### Authentication extras:

- [ ] Reset password
- [ ] Change password

### Real-time chat extras:

- [ ] Message history
- [ ] Message deletion
- [ ] Message editing
- [ ] Message reactions

### Real-time sketchpad extras:

- [ ] Sketchpad history
- [ ] Sketchpad deletion
- [ ] Sketchpad editing
- [ ] Sketchpad reactions

## Refactor Improvements:

- [ ] Add context everywhere it makes sense
- [ ] Add logging everywhere it makes sense, upgrade to slog?
- [ ] Add error handling everywhere it makes sense

## Ideas:

### Context:

- Request tracing for debugging
- Rate limiting information
- User preferences (like message formatting)
- Channel-specific settings

- *Remember*: Context values should be immutable and used sparingly. They're not for passing optional parameters or storing application state.
