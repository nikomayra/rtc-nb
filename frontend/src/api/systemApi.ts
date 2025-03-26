import { axiosInstance } from "./axiosInstance";
import { BASE_URL } from "../utils/constants";
import { IncomingMessage, Channel, APIResponse } from "../types/interfaces";
import axios from "axios";

//TODO do these need try/catch?

export const systemApi = {
  // Fetch all online users
  fetchAllOnlineUsers: async (token: string): Promise<APIResponse<string[]>> => {
    const res = await axiosInstance.get(`${BASE_URL}/onlineUsers`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.data.success) {
      return res.data;
    } else {
      throw new Error(`Failed to get all online users: ${res.data.error}`);
    }
  },

  // Fetch online users in a channel
  fetchOnlineUsersInChannel: async (channelName: string, token: string): Promise<APIResponse<string[]>> => {
    const res = await axiosInstance.get(`${BASE_URL}/onlineUsers/${encodeURIComponent(channelName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.data.success) {
      return res.data;
    } else {
      throw new Error(`Failed to get online users in channel: ${res.data.error}`);
    }
  },

  // Fetch messages for a channel
  fetchMessages: async (channelName: string, token: string): Promise<APIResponse<IncomingMessage[]>> => {
    const res = await axiosInstance.get(`${BASE_URL}/getMessages/${encodeURIComponent(channelName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.data.success) {
      return res.data;
    } else {
      throw new Error(`Failed to get messages: ${res.data.error}`);
    }
  },

  // Fetch available channels
  fetchChannels: async (token: string): Promise<APIResponse<Channel[]>> => {
    const res = await axiosInstance.get(`${BASE_URL}/channels`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.data.success) {
      return res.data;
    } else {
      throw new Error(`Failed to get channels: ${res.data.error}`);
    }
  },

  // Create a new channel
  createChannel: async (
    channelName: string,
    token: string,
    description?: string,
    password?: string
  ): Promise<APIResponse<Channel>> => {
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

    if (res.data.success) {
      return res.data;
    } else {
      throw new Error(`Failed to create channel: ${res.data.error}`);
    }
  },

  // Delete a channel
  deleteChannel: async (channelName: string, token: string): Promise<APIResponse<void>> => {
    const res = await axiosInstance.delete(`${BASE_URL}/deleteChannel/${encodeURIComponent(channelName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.data.success) {
      return res.data.success;
    } else {
      throw new Error(`Failed to delete channel: ${res.data.error}`);
    }
  },

  // Join a channel (including private channels that require a password)
  joinChannel: async (channelName: string, token: string, password?: string): Promise<APIResponse<void>> => {
    const res = await axiosInstance.patch(
      `${BASE_URL}/joinChannel/${encodeURIComponent(channelName)}`,
      {
        password: password || "",
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (res.data.success) {
      return res.data.success;
    } else {
      throw new Error(`Failed to join channel: ${res.data.error}`);
    }
  },

  // Leave a channel
  leaveChannel: async (channelName: string, token: string): Promise<APIResponse<void>> => {
    const res = await axiosInstance.patch(`${BASE_URL}/leaveChannel/${encodeURIComponent(channelName)}`, null, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.data.success) {
      return res.data.success;
    } else {
      throw new Error(`Failed to leave channel: ${res.data.error}`);
    }
  },

  // Update a member's role in a channel
  updateMemberRole: async (
    channelName: string,
    username: string,
    token: string,
    isAdmin: boolean
  ): Promise<APIResponse<void>> => {
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

    if (response.data.success) {
      return response.data.success;
    } else {
      throw new Error(`Failed to update role: ${response.data.error}`);
    }
  },

  // Upload a file to a channel - uses axios.post instead of axiosInstance.post to avoid interceptor issues
  uploadFile: async (
    formData: FormData,
    token: string
  ): Promise<APIResponse<{ imagePath: string; thumbnailPath: string }>> => {
    const response = await axios.post(`${BASE_URL}/upload`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });

    if (response.data.success) {
      return response.data;
    } else {
      throw new Error(`Failed to upload file: ${response.data.error}`);
    }
  },
};
