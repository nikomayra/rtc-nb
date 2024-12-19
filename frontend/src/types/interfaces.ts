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

export enum MessageType {
  Text = 0,
  Image = 1,
  Video = 2,
  Audio = 3,
  File = 4,
}

const URLSchema = z.string().refine((val) => {
  return val.startsWith('http') || val.startsWith('/');
}, 'Must be a valid URL or path');

const messageContentSchema = z.object({
  text: z.string().optional(),
  imageurl: URLSchema.optional(),
  thumbnailurl: URLSchema.optional(),
}).refine((data) => data.text !== undefined || data.imageurl !== undefined, {
  message: "At least one of 'text' or 'imageurl' must be provided",
});

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
