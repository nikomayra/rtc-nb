import { axiosInstance } from "./axiosInstance";
import { BASE_URL } from "../utils/constants";
import { z } from "zod";
import { Sketch, SketchSchema, APIResponse, APISuccessResponse, APIErrorResponse } from "../types/interfaces";

export const sketchApi = {
  // Save a sketch to the server
  createSketch: async (
    channelName: string,
    displayName: string,
    width: number,
    height: number,
    token: string
  ): Promise<Sketch> => {
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
      throw new Error((res.data as APIErrorResponse).error.message);
    }

    // Validate response data
    return SketchSchema.parse((res.data as APISuccessResponse<Sketch>).data);
  },

  // Load a sketch from the server
  getSketch: async (channelName: string, sketchId: string, token: string): Promise<Sketch | null> => {
    const res = await axiosInstance.get<APIResponse<Sketch>>(
      `${BASE_URL}/channels/${encodeURIComponent(channelName)}/sketches/${encodeURIComponent(sketchId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.data.success) {
      if ((res.data as APIErrorResponse).error.message === "Sketch not found") {
        return null;
      }
      throw new Error((res.data as APIErrorResponse).error.message);
    }

    // Validate response data
    return SketchSchema.parse((res.data as APISuccessResponse<Sketch>).data);
  },

  // Get all sketches for a channel
  getSketches: async (channelName: string, token: string): Promise<Sketch[]> => {
    const res = await axiosInstance.get<APIResponse<Sketch[]>>(
      `${BASE_URL}/channels/${encodeURIComponent(channelName)}/sketches`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.data.success) {
      throw new Error((res.data as APIErrorResponse).error.message);
    }

    // Validate response data
    return z.array(SketchSchema).parse((res.data as APISuccessResponse<Sketch[]>).data);
  },

  // Delete a sketch from the server
  deleteSketch: async (sketchId: string, token: string): Promise<void> => {
    const res = await axiosInstance.delete<APIResponse<void>>(
      `${BASE_URL}/deleteSketch/${encodeURIComponent(sketchId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.data.success) {
      throw new Error((res.data as APIErrorResponse).error.message);
    }
  },

  // Clear a sketch from the server
  clearSketch: async (channelName: string, sketchId: string, token: string): Promise<void> => {
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
      throw new Error((res.data as APIErrorResponse).error.message);
    }
  },
};
