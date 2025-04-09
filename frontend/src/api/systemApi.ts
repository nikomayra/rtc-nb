import { axiosInstance } from "./axiosInstance";
import { BASE_URL } from "../utils/constants";
import { Channel, APIResponse, APIErrorResponse } from "../types/interfaces";

export const systemApi = {
  // Fetch all online users
  fetchCountOfAllOnlineUsers: async (token: string): Promise<APIResponse<number>> => {
    const res = await axiosInstance.get(`${BASE_URL}/onlineUsersCount`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.data.success) {
      throw new Error((res.data as APIErrorResponse).error.message || "Failed to get count of all online users");
    }
    return res.data;
  },

  // Fetch available channels
  fetchChannels: async (token: string): Promise<APIResponse<Channel[]>> => {
    const res = await axiosInstance.get(`${BASE_URL}/channels`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.data.success) {
      throw new Error((res.data as APIErrorResponse).error.message || "Failed to get channels");
    }
    return res.data;
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
    if (!res.data.success) {
      throw new Error((res.data as APIErrorResponse).error.message || "Failed to create channel");
    }
    return res.data;
  },

  // Delete a channel
  deleteChannel: async (channelName: string, token: string): Promise<APIResponse<void>> => {
    const res = await axiosInstance.delete(`${BASE_URL}/deleteChannel/${encodeURIComponent(channelName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.data.success) {
      throw new Error((res.data as APIErrorResponse).error.message || "Failed to delete channel");
    }
    return res.data;
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
    if (!res.data.success) {
      throw new Error((res.data as APIErrorResponse).error.message || "Failed to join channel");
    }
    return res.data;
  },

  // Leave a channel
  leaveChannel: async (channelName: string, token: string): Promise<APIResponse<void>> => {
    const res = await axiosInstance.patch(`${BASE_URL}/leaveChannel/${encodeURIComponent(channelName)}`, null, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.data.success) {
      throw new Error((res.data as APIErrorResponse).error.message || "Failed to leave channel");
    }
    return res.data;
  },
};
