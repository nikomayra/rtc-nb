import { z } from 'zod';

export const ChannelSchema = z.object({
  name: z.string(),
  password: z.string().optional(),
  description: z.string().optional(),
  createdAt: z.string(),
  users: z.array(z.string()),
  admins: z.array(z.string()),
});

export type Channel = z.infer<typeof ChannelSchema>;

export interface Message {
  id: string;
  username: string;
  content: { text: string };
  timestamp: string;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: number;
  };
}
