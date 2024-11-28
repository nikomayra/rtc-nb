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

export const OutgoingMessageSchema = z.object({
  channelName: z.string().min(1),
  type: z.number().int().min(0),
  content: z.object({
    text: z.string().min(1),
  }),
});

export const IncomingMessageSchema = z.object({
  id: z.string().uuid(),
  channelName: z.string().min(1),
  username: z.string().min(1),
  type: z.number().int().min(0),
  content: z.object({
    text: z.string().min(1),
  }),
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
