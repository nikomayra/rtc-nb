import { z } from "zod";

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

export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const DrawPathSchema = z.object({
  points: z.array(PointSchema),
  isDrawing: z.boolean(),
  strokeWidth: z.number().min(1).default(1),
});

export const RegionSchema = z.object({
  start: PointSchema,
  end: PointSchema,
  paths: z.array(DrawPathSchema),
});

export const SketchUpdateSchema = z.object({
  sketchId: z.string().uuid(),
  region: RegionSchema,
});

export const SketchSchema = z.object({
  id: z.string().uuid(),
  channelName: z.string().min(1),
  displayName: z.string().min(1),
  width: z.number().min(1),
  height: z.number().min(1),
  regions: z.record(z.string(), RegionSchema), // Key format: "x,y"
  createdAt: z.string().min(1).datetime(),
  createdBy: z.string().min(1),
});

export const RegionlessSketchSchema = z.object({
  id: z.string().uuid(),
  channelName: z.string().min(1),
  displayName: z.string().min(1),
  width: z.number().min(1),
  height: z.number().min(1),
  createdAt: z.string().min(1).datetime(),
  createdBy: z.string().min(1),
});

export enum MessageType {
  Text = 0,
  Image = 1,
  Video = 2,
  Audio = 3,
  Document = 4,
  SketchUpdate = 5,
}

const URLSchema = z.string().refine((val) => {
  return val.startsWith("http") || val.startsWith("/");
}, "Must be a valid URL or path");

const messageContentSchema = z
  .object({
    text: z.string().optional(),
    fileUrl: URLSchema.optional(),
    thumbnailUrl: URLSchema.optional(),
    sketchUpdate: SketchUpdateSchema.optional(),
  })
  .refine(
    (data) => {
      // For sketch messages
      if (data.sketchUpdate !== undefined) {
        return data.sketchUpdate.sketchId !== undefined && data.sketchUpdate.region !== undefined;
      }
      // For file messages
      if (data.fileUrl !== undefined) {
        return true; // text is optional for file messages
      }
      // For text-only messages
      return data.text !== undefined;
    },
    {
      message:
        "Message must be either: (1) text message with optional file, (2) file message with optional text, or (3) sketch message with both sketchid and region",
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

export type Channel = z.infer<typeof ChannelSchema>;
export type ChannelMember = z.infer<typeof ChannelMemberSchema>;

export type APIResponse<T> = APISuccessResponse<T> | APIErrorResponse;

export type OutgoingMessage = z.infer<typeof OutgoingMessageSchema>;
export type IncomingMessage = z.infer<typeof IncomingMessageSchema>;

export type Point = z.infer<typeof PointSchema>;
export type DrawPath = z.infer<typeof DrawPathSchema>;
export type Region = z.infer<typeof RegionSchema>;
export type Sketch = z.infer<typeof SketchSchema>;
export type SketchUpdate = z.infer<typeof SketchUpdateSchema>;
export type RegionlessSketch = z.infer<typeof RegionlessSketchSchema>;
