package models

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

type MessageType int

const (
	MessageTypeText MessageType = iota
	MessageTypeImage
	MessageTypeSketch
	MessageTypeChannelUpdate
	MessageTypeMemberUpdate
	MessageTypeUserStatus
	MessageTypeSystemUserStatus
)

type ChannelUpdate struct {
	Action  string   `json:"action"`  // "created", "deleted"
	Channel *Channel `json:"channel"` // The channel data
}

type MemberUpdate struct {
	Action   string `json:"action"` // "added", "role_changed"
	Username string `json:"username"`
	IsAdmin  bool   `json:"is_admin"`
}

type UserStatus struct {
	Action   string `json:"action"` // "online", "offline"
	Username string `json:"username"`
}

type SystemUserStatus struct {
	Count int `json:"count"`
}

type SketchCommandType string

const (
	SketchCommandTypeUpdate SketchCommandType = "UPDATE"
	SketchCommandTypeClear  SketchCommandType = "CLEAR"
	SketchCommandTypeDelete SketchCommandType = "DELETE"
	SketchCommandTypeNew    SketchCommandType = "NEW"
)

type SketchCommand struct {
	CommandType SketchCommandType `json:"command_type"`
	SketchID    string            `json:"sketch_id"`
	IsPartial   *bool             `json:"is_partial,omitempty"`
	SketchData  *Sketch           `json:"sketch_data,omitempty"`
	Region      *Region           `json:"region,omitempty"`
}

type MessageContent struct {
	Text             *string           `json:"text,omitempty"`
	FileURL          *string           `json:"file_url,omitempty"`
	ThumbnailURL     *string           `json:"thumbnail_url,omitempty"`
	SketchCmd        *SketchCommand    `json:"sketch_cmd,omitempty"`
	ChannelUpdate    *ChannelUpdate    `json:"channel_update,omitempty"`
	MemberUpdate     *MemberUpdate     `json:"member_update,omitempty"`
	UserStatus       *UserStatus       `json:"user_status,omitempty"`
	SystemUserStatus *SystemUserStatus `json:"system_user_status,omitempty"`
}

type IncomingMessage struct {
	ChannelName string         `json:"channel_name"`
	Type        MessageType    `json:"type"`
	Content     MessageContent `json:"content"`
}

type Message struct {
	ID          string         `json:"id"`
	ChannelName string         `json:"channel_name"`
	Username    string         `json:"username"`
	Type        MessageType    `json:"type"`
	Content     MessageContent `json:"content"`
	Timestamp   time.Time      `json:"timestamp"`
}

func (m *IncomingMessage) Validate() error {
	if m.ChannelName == "" {
		return errors.New("channel name required")
	}

	switch m.Type {
	case MessageTypeText:
		if m.Content.Text == nil {
			return errors.New("text content required for text message")
		}
	case MessageTypeImage:
		if m.Content.FileURL == nil || m.Content.ThumbnailURL == nil {
			return errors.New("file and thumbnail URLs required for file message")
		}
	case MessageTypeSketch:
		if m.Content.SketchCmd == nil {
			return errors.New("sketch command required for sketch message")
		}
		cmd := m.Content.SketchCmd
		if cmd.SketchID == "" {
			return errors.New("sketch ID required for all sketch commands")
		}
		switch cmd.CommandType {
		case SketchCommandTypeUpdate:
			if cmd.Region == nil || cmd.Region.Paths == nil || len(cmd.Region.Paths) == 0 || cmd.IsPartial == nil {
				return errors.New("region with at least one path, and isPartial flag required for sketch update")
			}
		case SketchCommandTypeClear, SketchCommandTypeDelete:
			break
		case SketchCommandTypeNew:
			if cmd.SketchData == nil {
				return errors.New("sketch data required for new sketch command")
			}
		default:
			return errors.New("invalid sketch command type")
		}
	case MessageTypeChannelUpdate:
		if m.Content.ChannelUpdate == nil {
			return errors.New("channel update data required")
		}
		switch m.Content.ChannelUpdate.Action {
		case "created", "deleted", "updated":
			if m.Content.ChannelUpdate.Channel == nil {
				return errors.New("channel data required for channel update")
			}
		default:
			return errors.New("invalid channel update action")
		}
	case MessageTypeMemberUpdate:
		if m.Content.MemberUpdate == nil {
			return errors.New("member update data required")
		}
		if m.ChannelName == "" {
			return errors.New("channel name required for member update")
		}
		switch m.Content.MemberUpdate.Action {
		case "added", "role_changed":
			if m.Content.MemberUpdate.Username == "" {
				return errors.New("username required for member update")
			}
		default:
			return errors.New("invalid member update action")
		}
	case MessageTypeUserStatus:
		if m.Content.UserStatus == nil {
			return errors.New("user status data required")
		}
		switch m.Content.UserStatus.Action {
		case "online", "offline":
			if m.ChannelName == "" || m.Content.UserStatus.Username == "" {
				return errors.New("channel name and username required for user status")
			}
		default:
			return errors.New("invalid user status action")
		}
	case MessageTypeSystemUserStatus:
		if m.Content.SystemUserStatus == nil {
			return errors.New("system user status data required")
		}
	default:
		return errors.New("invalid message type")
	}

	return nil
}

func NewMessage(incoming *IncomingMessage, username string) (*Message, error) {
	if err := incoming.Validate(); err != nil {
		return nil, err
	}

	return &Message{
		ID:          uuid.NewString(),
		ChannelName: incoming.ChannelName,
		Username:    username,
		Type:        incoming.Type,
		Content:     incoming.Content,
		Timestamp:   time.Now().UTC(),
	}, nil
}

// NewChannelUpdateMessage creates a system message for channel lifecycle events.
// The username is set to "system" as these are global notifications.
func NewChannelUpdateMessage(action string, channel *Channel) *Message {
	return &Message{
		ID:          uuid.NewString(),
		ChannelName: "system", // System messages don't belong to a specific channel context
		Username:    "system",
		Type:        MessageTypeChannelUpdate,
		Timestamp:   time.Now().UTC(),
		Content: MessageContent{
			ChannelUpdate: &ChannelUpdate{
				Action:  action,
				Channel: channel,
			},
		},
	}
}

// NewMemberUpdateMessage creates a channel message for member status changes.
// The actorUsername is the user performing the action (e.g., added, role_changed).
// The targetUsername is the user whose status is changing.
func NewMemberUpdateMessage(channelName, actorUsername, targetUsername, action string, isAdmin bool) *Message {
	return &Message{
		ID:          uuid.NewString(),
		ChannelName: channelName,
		Username:    actorUsername, // User performing the action
		Type:        MessageTypeMemberUpdate,
		Timestamp:   time.Now().UTC(),
		Content: MessageContent{
			MemberUpdate: &MemberUpdate{
				Action:   action,
				Username: targetUsername, // User being acted upon
				IsAdmin:  isAdmin,
			},
		},
	}
}

// Helper function to create a Sketch command message for broadcasting
// Used by API handlers after successful operations (Create, Delete, Clear)
func NewSketchBroadcastMessage(channelName, username string, command SketchCommand) *Message {
	return &Message{
		ID:          uuid.NewString(),
		ChannelName: channelName,
		Username:    username, // User who initiated the API action
		Type:        MessageTypeSketch,
		Timestamp:   time.Now().UTC(),
		Content: MessageContent{
			SketchCmd: &command,
		},
	}
}

// func (m *Message) RequiresPersistence() bool {
// 	switch m.Type {
// 	case MessageTypeSketch:
// 		// Only persist COMPLETE sketch updates
// 		if m.Content.SketchCmd != nil &&
// 			m.Content.SketchCmd.CommandType == SketchCommandTypeUpdate &&
// 			m.Content.SketchCmd.IsPartial != nil &&
// 			!*m.Content.SketchCmd.IsPartial {
// 			return true
// 		}
// 		return false
// 	case MessageTypeChannelUpdate, MessageTypeMemberUpdate, MessageTypeUserStatus, MessageTypeSystemUserStatus:
// 		// System/Status messages generally not persisted this way
// 		return false
// 	default: // Text, Image
// 		return true
// 	}
// }
