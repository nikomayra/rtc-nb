import { z } from 'zod';

export const ChannelMemberSchema = z.object({
  username: z.string().min(1),
  isAdmin: z.boolean(),
  joinedAt: z.string().min(1).datetime(),
  lastMessage: z.string().datetime().optional().nullable(),
});

export const ChannelSchema = z.object({
  name: z.string().min(1),
  isPrivate: z.boolean(),
  description: z.string().optional().nullable(),
  createdBy: z.string().min(1),
  createdAt: z.string().min(1).datetime(),
  members: z.record(z.string(), ChannelMemberSchema),
});

export type Channel = z.infer<typeof ChannelSchema>;
export type ChannelMember = z.infer<typeof ChannelMemberSchema>;

export const SketchSchema = z.object({
  id: z.string().uuid(),
  channelName: z.string().min(1),
  displayName: z.string().min(1),
  width: z.number().min(1),
  height: z.number().min(1),
  pixels: z.array(z.array(z.boolean())),
  createdAt: z.string().min(1).datetime(),
  createdBy: z.string().min(1),
});

export type Sketch = z.infer<typeof SketchSchema>;

export enum MessageType {
  Text = 0,
  Image = 1,
  Video = 2,
  Audio = 3,
  Document = 4,
  Sketch = 5,
}

const URLSchema = z.string().refine((val) => {
  return val.startsWith('http') || val.startsWith('/');
}, 'Must be a valid URL or path');

const messageContentSchema = z.object({
  text: z.string().optional(),
  fileurl: URLSchema.optional(),
  thumbnailurl: URLSchema.optional(),
  sketchcoords: z.array(z.array(z.boolean())).optional(),
  sketchid: z.string().uuid().optional(),
}).refine(
  (data) => {
    // For sketch messages
    if (data.sketchid !== undefined || data.sketchcoords !== undefined) {
      return data.sketchid !== undefined && data.sketchcoords !== undefined;
    }
    // For file messages
    if (data.fileurl !== undefined) {
      return true; // text is optional for file messages
    }
    // For text-only messages
    return data.text !== undefined;
  },
  {
    message: "Message must be either: (1) text message with optional file, (2) file message with optional text, or (3) sketch message with both sketchid and sketchcoords"
  }
);

export const OutgoingMessageSchema = z.object({
  channelName: z.string().min(1),
  type: z.nativeEnum(MessageType),
  content: messageContentSchema,
});

export const IncomingMessageSchema = z.object({
  id: z.string().uuid(),
  channelName: z.string().min(1),
  username: z.string().min(1),
  type: z.nativeEnum(MessageType),
  content: messageContentSchema,
  timestamp: z.string().datetime(),
});

// Type definitions
export type OutgoingMessage = z.infer<typeof OutgoingMessageSchema>;
export type IncomingMessage = z.infer<typeof IncomingMessageSchema>;

interface APISuccessResponse<T> {
  success: true;
  data: T;
}

interface APIErrorResponse {
  success: false;
  error: {
    message: string;
    code: number;
  };
}

export type APIResponse<T> = APISuccessResponse<T> | APIErrorResponse;
