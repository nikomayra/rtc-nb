import { z } from "zod";

// ============= Enums =============

export enum MessageType {
  Text = 0,
  Image = 1,
  Sketch = 2,
  ChannelUpdate = 3,
  MemberUpdate = 4,
  UserStatus = 5,
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

// ============= Zod Schemas =============

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

export const SketchCommandSchema = z
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

export const ChannelUpdateSchema = z.object({
  action: z.nativeEnum(ChannelUpdateAction),
  channel: ChannelSchema,
});

export const MemberUpdateSchema = z.object({
  action: z.nativeEnum(MemberUpdateAction),
  username: z.string().min(1),
  isAdmin: z.boolean(),
});

export const UserStatusSchema = z.object({
  action: z.enum(["online", "offline"]),
  username: z.string().min(1),
});

// Custom URL validator that accepts both URLs and paths
const URLSchema = z.string().refine(
  (val) => {
    try {
      new URL(val);
      return true;
    } catch {
      // Allow paths starting with /
      return val.startsWith("/");
    }
  },
  { message: "Invalid URL or path" }
);

export const MessageContentSchema = z
  .object({
    text: z.string().optional(),
    fileUrl: URLSchema.optional(),
    thumbnailUrl: URLSchema.optional(),
    sketchCmd: SketchCommandSchema.optional(),
    channelUpdate: ChannelUpdateSchema.optional(),
    memberUpdate: MemberUpdateSchema.optional(),
    userStatus: UserStatusSchema.optional(),
  })
  .refine(
    (data) => {
      // Ensure that if it's an image message, both fileUrl and thumbnailUrl are present
      if (data.fileUrl || data.thumbnailUrl) {
        return data.fileUrl && data.thumbnailUrl;
      }
      return true;
    },
    {
      message: "Both fileUrl and thumbnailUrl must be present for image messages",
    }
  );

export const OutgoingMessageSchema = z.object({
  channelName: z.string().min(1),
  type: z.nativeEnum(MessageType),
  content: MessageContentSchema,
});

export const IncomingMessageSchema = z.object({
  id: z.string().uuid(),
  channelName: z.string().min(1),
  username: z.string().min(1),
  type: z.nativeEnum(MessageType),
  content: MessageContentSchema,
  timestamp: z.string().datetime(),
});

// ============= Types =============

// Infer types from Zod schemas
export type Point = z.infer<typeof PointSchema>;
export type DrawPath = z.infer<typeof DrawPathSchema>;
export type Region = z.infer<typeof RegionSchema>;
export type Channel = z.infer<typeof ChannelSchema>;
export type ChannelMember = z.infer<typeof ChannelMemberSchema>;
export type Sketch = z.infer<typeof SketchSchema>;
export type SketchCommand = z.infer<typeof SketchCommandSchema>;
export type ChannelUpdate = z.infer<typeof ChannelUpdateSchema>;
export type MemberUpdate = z.infer<typeof MemberUpdateSchema>;
export type UserStatus = z.infer<typeof UserStatusSchema>;
export type MessageContent = z.infer<typeof MessageContentSchema>;
export type OutgoingMessage = z.infer<typeof OutgoingMessageSchema>;
export type IncomingMessage = z.infer<typeof IncomingMessageSchema>;

// API Response types
export interface APISuccessResponse<T> {
  success: true;
  data: T;
}

export interface APIErrorResponse {
  success: false;
  error: {
    message: string;
    code: number;
  };
}

export type APIResponse<T> = APISuccessResponse<T> | APIErrorResponse;
