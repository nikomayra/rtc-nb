import { axiosInstance } from "./axiosInstance";
import { BASE_URL } from "../utils/constants";
import { Sketch } from "../types/interfaces";

export const sketchApi = {
  // Save a sketch to the server
  createSketch: async (
    channelName: string,
    displayName: string,
    width: number,
    height: number,
    token: string
  ): Promise<void> => {
    const res = await axiosInstance.post(
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
      throw new Error(`Failed to save sketch: ${res.data.error}`);
    }
  },

  // Load a sketch from the server
  getSketch: async (channelName: string, sketchId: string, token: string): Promise<Sketch | null> => {
    const res = await axiosInstance.get(
      `${BASE_URL}/channels/${encodeURIComponent(channelName)}/sketches/${encodeURIComponent(sketchId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (res.data.success) {
      return res.data.data as Sketch;
    } else if (res.data.error === "Sketch not found") {
      return null;
    } else {
      throw new Error(`Failed to load sketch: ${res.data.error}`);
    }
  },

  // Get all sketches for a channel
  getSketches: async (channelName: string, token: string): Promise<Sketch[]> => {
    const res = await axiosInstance.get(`${BASE_URL}/channels/${encodeURIComponent(channelName)}/sketches`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.data.success) {
      return res.data.data as Sketch[];
    } else {
      throw new Error(`Failed to load sketches: ${res.data.error}`);
    }
  },

  // Delete a sketch from the server
  deleteSketch: async (sketchId: string, token: string): Promise<void> => {
    const res = await axiosInstance.delete(`${BASE_URL}/deleteSketch/${encodeURIComponent(sketchId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.data.success) {
      throw new Error(`Failed to delete sketch: ${res.data.error}`);
    }
  },

  // Clear a sketch from the server
  clearSketch: async (channelName: string, sketchId: string, token: string): Promise<void> => {
    const res = await axiosInstance.post(
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
      throw new Error(`Failed to clear sketch: ${res.data.error}`);
    }
  },
};
