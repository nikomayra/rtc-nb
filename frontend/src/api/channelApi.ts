import { axiosInstance } from "./axiosInstance";
import { BASE_URL } from "../utils/constants";
import { IncomingMessage, ChannelMember, APIResponse, APIErrorResponse } from "../types/interfaces";
import axios from "axios";

export const channelApi = {
  // Get channel members
  fetchMembers: async (channelName: string, token: string): Promise<APIResponse<ChannelMember[]>> => {
    const res = await axiosInstance.get(`${BASE_URL}/channels/${encodeURIComponent(channelName)}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.data.success) {
      throw new Error((res.data as APIErrorResponse).error.message || "Failed to get members");
    }
    return res.data;
  },

  // Fetch online users in a channel
  fetchOnlineUsersInChannel: async (channelName: string, token: string): Promise<APIResponse<string[]>> => {
    const res = await axiosInstance.get(`${BASE_URL}/onlineUsers/${encodeURIComponent(channelName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.data.success) {
      throw new Error((res.data as APIErrorResponse).error.message || "Failed to get online users in channel");
    }
    return res.data;
  },

  // Fetch messages for a channel
  fetchMessages: async (channelName: string, token: string): Promise<APIResponse<IncomingMessage[]>> => {
    const res = await axiosInstance.get(`${BASE_URL}/getMessages/${encodeURIComponent(channelName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.data.success) {
      throw new Error((res.data as APIErrorResponse).error.message || "Failed to get messages");
    }
    return res.data;
  },

  // Update a member's role in a channel
  updateMemberRole: async (
    channelName: string,
    username: string,
    token: string,
    isAdmin: boolean
  ): Promise<APIResponse<void>> => {
    const res = await axiosInstance.patch(
      `${BASE_URL}/channels/${encodeURIComponent(channelName)}/members/${encodeURIComponent(username)}/role`,
      { is_admin: isAdmin },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.data.success) {
      throw new Error((res.data as APIErrorResponse).error.message || "Failed to update role");
    }
    return res.data;
  },

  // Upload a file to a channel - uses axios.post instead of axiosInstance.post to avoid interceptor issues
  uploadFile: async (
    formData: FormData,
    token: string
  ): Promise<APIResponse<{ imagePath: string; thumbnailPath: string }>> => {
    try {
      const response = await axios.post<{ imagePath: string; thumbnailPath: string } & APIResponse<unknown>>(
        `${BASE_URL}/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      if (!response.data.success) {
        throw new Error((response.data as APIErrorResponse).error.message || "Failed to upload file");
      }
      return response.data as APIResponse<{ imagePath: string; thumbnailPath: string }>;
    } catch (error) {
      console.error("Raw axios upload error:", error);
      const message = error instanceof Error ? error.message : "Upload failed due to network issue";
      throw new Error(message);
    }
  },
};
