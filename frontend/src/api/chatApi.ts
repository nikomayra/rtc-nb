import { axiosInstance } from "./axiosInstance";
import { BASE_URL } from "../utils/constants";
import { z } from "zod";
import { IncomingMessage, IncomingMessageSchema, Channel, ChannelSchema } from "../types/interfaces";

export const chatApi = {
  // Fetch messages for a channel
  fetchMessages: async (channelName: string, token: string): Promise<IncomingMessage[]> => {
    const res = await axiosInstance.get(`${BASE_URL}/getMessages/${encodeURIComponent(channelName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.data.success) {
      return z.array(IncomingMessageSchema).parse(res.data.data);
    } else {
      throw new Error(`Failed to get messages: ${res.data.error}`);
    }
  },

  // Fetch available channels
  fetchChannels: async (token: string): Promise<Channel[]> => {
    const res = await axiosInstance.get(`${BASE_URL}/channels`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.data.success) {
      return z.array(ChannelSchema).parse(res.data.data);
    } else {
      throw new Error(`Failed to get channels: ${res.data.error}`);
    }
  },

  // Create a new channel
  createChannel: async (channelName: string, token: string, description?: string, password?: string): Promise<void> => {
    const res = await axiosInstance.post(
      `${BASE_URL}/createChannel/${encodeURIComponent(channelName)}`,
      {
        description: description || "",
        password: password || "",
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.data.success) {
      throw new Error(`Failed to create channel: ${res.data.error}`);
    }
  },

  // Delete a channel
  deleteChannel: async (channelName: string, token: string): Promise<void> => {
    const res = await axiosInstance.delete(`${BASE_URL}/deleteChannel/${encodeURIComponent(channelName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.data.success) {
      throw new Error(`Failed to delete channel: ${res.data.error}`);
    }
  },

  // Join a channel (including private channels that require a password)
  joinChannel: async (
    channelName: string,
    token: string,
    password?: string
  ): Promise<{ onlineUsers: string[]; isFirstJoin: boolean }> => {
    const res = await axiosInstance.patch(
      `${BASE_URL}/joinChannel/${encodeURIComponent(channelName)}`,
      {
        password: password || "",
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.data.success) {
      throw new Error(`Failed to join channel: ${res.data.error}`);
    }

    // Return online users and isFirstJoin flag from the response
    return {
      onlineUsers: res.data.data.onlineUsers || [],
      isFirstJoin: res.data.data.isFirstJoin || false,
    };
  },

  // Leave a channel
  leaveChannel: async (channelName: string, token: string): Promise<void> => {
    const res = await axiosInstance.patch(`${BASE_URL}/leaveChannel/${encodeURIComponent(channelName)}`, null, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.data.success) {
      throw new Error(`Failed to leave channel: ${res.data.error}`);
    }
  },

  // Update a member's role in a channel
  updateMemberRole: async (channelName: string, username: string, token: string, isAdmin: boolean): Promise<void> => {
    const response = await axiosInstance.patch(
      `${BASE_URL}/channels/${encodeURIComponent(channelName)}/members/${encodeURIComponent(username)}/role`,
      {
        is_admin: isAdmin,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.data.success) {
      throw new Error(`Failed to update role: ${response.data.error}`);
    }
  },

  // Upload a file to a channel
  uploadFile: async (formData: FormData, token: string): Promise<{ imagePath: string; thumbnailPath: string }> => {
    const response = await axiosInstance.post(`${BASE_URL}/upload`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });

    if (!response.data.success) {
      throw new Error(`Failed to upload file: ${response.data.error}`);
    }

    return {
      imagePath: response.data.data.imagePath,
      thumbnailPath: response.data.data.thumbnailPath,
    };
  },
};
