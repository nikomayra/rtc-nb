import { z } from 'zod';

export const ChannelSchema = z.object({
  name: z.string(),
  isPrivate: z.boolean(),
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
