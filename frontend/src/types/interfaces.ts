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

export const SketchSchema = z.object({
  id: z.string().uuid(),
  channelName: z.string().min(1),
  displayName: z.string().min(1),
  width: z.number().min(1),
  height: z.number().min(1),
  regions: z.record(z.string(), RegionSchema).default({}),
  createdAt: z.string().min(1).datetime(),
  createdBy: z.string().min(1),
});

export enum MessageType {
  Text = 0,
  Image = 1,
  Sketch = 2,
  ChannelUpdate = 3,
  MemberUpdate = 4,
}

export enum SketchCommandType {
  Update = "UPDATE",
  Clear = "CLEAR",
  Delete = "DELETE",
  New = "NEW",
  Select = "SELECT",
}

export enum ChannelUpdateAction {
  Created = "created",
  Deleted = "deleted",
}

export enum MemberUpdateAction {
  Added = "added",
  RoleChanged = "role_changed",
  Removed = "removed",
}

const SketchCommandSchema = z
  .object({
    commandType: z.nativeEnum(SketchCommandType),
    sketchId: z.string().uuid(),
    region: RegionSchema.optional(),
    sketchData: SketchSchema.optional(),
    pathId: z.string().uuid().optional(),
  })
  .refine(
    (data) => {
      if (data.commandType === SketchCommandType.Update) {
        return data.region !== undefined;
      }
      return true; // Clear and Delete only need sketchId
    },
    {
      message: "Invalid sketch command structure",
    }
  );

const ChannelUpdateSchema = z.object({
  action: z.nativeEnum(ChannelUpdateAction),
  channel: ChannelSchema,
});

const MemberUpdateSchema = z.object({
  action: z.nativeEnum(MemberUpdateAction),
  username: z.string().min(1),
  isAdmin: z.boolean(),
});

export type ChannelUpdate = z.infer<typeof ChannelUpdateSchema>;
export type MemberUpdate = z.infer<typeof MemberUpdateSchema>;
export type SketchCommand = z.infer<typeof SketchCommandSchema>;

const URLSchema = z.string().refine((val) => {
  return val.startsWith("http") || val.startsWith("/");
}, "Must be a valid URL or path");

const messageContentSchema = z.object({
  text: z.string().optional(),
  fileUrl: URLSchema.optional(),
  thumbnailUrl: URLSchema.optional(),
  sketchCmd: SketchCommandSchema.optional(),
  channelUpdate: ChannelUpdateSchema.optional(),
  memberUpdate: MemberUpdateSchema.optional(),
});

export type MessageContent = z.infer<typeof messageContentSchema>;

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
// export type RegionlessSketch = z.infer<typeof RegionlessSketchSchema>;
