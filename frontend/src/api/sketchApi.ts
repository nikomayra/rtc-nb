import { axiosInstance } from "./axiosInstance";
import { BASE_URL } from "../utils/constants";
import { Sketch, APIResponse, APIErrorResponse } from "../types/interfaces";

export const sketchApi = {
  // Create a sketch on the server
  createSketch: async (
    channelName: string,
    displayName: string,
    width: number,
    height: number,
    token: string
  ): Promise<APIResponse<Sketch>> => {
    const res = await axiosInstance.post<APIResponse<Sketch>>(
      `${BASE_URL}/createSketch`,
      {
        channelName,
        displayName,
        width,
        height,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.data.success) {
      throw new Error((res.data as APIErrorResponse).error.message || "Failed to create sketch");
    }
    return res.data;
  },

  // Load a sketch from the server
  getSketch: async (channelName: string, sketchId: string, token: string): Promise<APIResponse<Sketch>> => {
    const res = await axiosInstance.get<APIResponse<Sketch>>(
      `${BASE_URL}/channels/${encodeURIComponent(channelName)}/sketches/${encodeURIComponent(sketchId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.data.success) {
      if ((res.data as APIErrorResponse).error.message === "Sketch not found") {
        return res.data;
      }
      throw new Error((res.data as APIErrorResponse).error.message || "Failed to get sketch");
    }
    return res.data;
  },

  // Get all sketches for a channel
  getSketches: async (channelName: string, token: string): Promise<APIResponse<Sketch[]>> => {
    const res = await axiosInstance.get<APIResponse<Sketch[]>>(
      `${BASE_URL}/channels/${encodeURIComponent(channelName)}/sketches`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.data.success) {
      throw new Error((res.data as APIErrorResponse).error.message || "Failed to get sketches");
    }
    return res.data;
  },

  // Delete a sketch from the server
  deleteSketch: async (sketchId: string, token: string): Promise<APIResponse<void>> => {
    const res = await axiosInstance.delete<APIResponse<void>>(
      `${BASE_URL}/deleteSketch/${encodeURIComponent(sketchId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.data.success) {
      throw new Error((res.data as APIErrorResponse).error.message || "Failed to delete sketch");
    }
    return res.data;
  },

  // Clear a sketch from the server
  clearSketch: async (channelName: string, sketchId: string, token: string): Promise<APIResponse<void>> => {
    const res = await axiosInstance.post<APIResponse<void>>(
      `${BASE_URL}/clearSketch`,
      {
        channelName,
        sketchId,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.data.success) {
      throw new Error((res.data as APIErrorResponse).error.message || "Failed to clear sketch");
    }
    return res.data;
  },
};
