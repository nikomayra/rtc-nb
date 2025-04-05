import { axiosInstance } from "./axiosInstance";
import { BASE_URL } from "../utils/constants";
import { IncomingMessage, ChannelMember, APIResponse } from "../types/interfaces";
import axios from "axios";

export const channelApi = {
  // Get channel members
  fetchMembers: async (channelName: string, token: string): Promise<APIResponse<ChannelMember[]>> => {
    const res = await axiosInstance.get(`${BASE_URL}/channels/${encodeURIComponent(channelName)}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.data.success) {
      return res.data;
    } else {
      throw new Error(`Failed to get members: ${res.data.error}`);
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
      return response.data;
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
