import { axiosInstance } from "./axiosInstance";
import { BASE_URL } from "../utils/constants";
import { Channel, APIResponse } from "../types/interfaces";

export const systemApi = {
  // Fetch all online users
  fetchCountOfAllOnlineUsers: async (token: string): Promise<APIResponse<number>> => {
    const res = await axiosInstance.get(`${BASE_URL}/onlineUsersCount`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.data.success) {
      return res.data;
    } else {
      throw new Error(`Failed to get count of all online users: ${res.data.error}`);
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
      return res.data;
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
      return res.data;
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
      return res.data;
    } else {
      throw new Error(`Failed to leave channel: ${res.data.error}`);
    }
  },
};
