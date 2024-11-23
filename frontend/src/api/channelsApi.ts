import axios from 'axios';
import { APIResponse, Channel, ChannelSchema } from '../types/interfaces';
import { BASE_URL } from '../utils/constants';
import { z } from 'zod';

export const channelsApi = {
  create: async (
    channelName: string,
    description: string,
    password: string | undefined,
    token: string
  ): Promise<APIResponse<Channel>> => {
    try {
      const res = await axios.post(
        `${BASE_URL}/createchannel`,
        {
          channelName: channelName,
          channelDescription: description,
          channelPassword: password,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        const validatedChannel = ChannelSchema.parse(res.data.data);
        return { success: res.data.success, data: validatedChannel };
      } else {
        return { success: res.data.success, error: res.data.error };
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Invalid channel data:', error.errors);
        return {
          success: false,
          error: { message: 'Server returned invalid channel data', code: 422 },
        };
      }
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: {
            message:
              error.response?.data?.message || 'Failed to create channel',
            code: error.response?.status || 500,
          },
        };
      }
      return {
        success: false,
        error: { message: 'Unknown error', code: 500 },
      };
    }
  },

  join: async (
    channelName: string,
    password: string | undefined,
    token: string
  ): Promise<APIResponse<void>> => {
    try {
      const res = await axios.post(
        `${BASE_URL}/joinchannel`,
        { channelName: channelName, channelPassword: password },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        return { success: res.data.success, data: res.data.data };
      } else {
        return { success: res.data.success, error: res.data.error };
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: {
            message: error.response?.data?.message || 'Failed to get channel',
            code: error.response?.status || 500,
          },
        };
      }
      return {
        success: false,
        error: { message: 'Unknown error', code: 500 },
      };
    }
  },

  getAll: async (token: string): Promise<APIResponse<Channel[]>> => {
    try {
      const res = await axios.get(`${BASE_URL}/channels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        const validatedChannels = z.array(ChannelSchema).parse(res.data.data);
        return { success: res.data.success, data: validatedChannels };
      } else {
        return { success: res.data.success, error: res.data.error };
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Invalid channels data:', error.errors);
        return {
          success: false,
          error: {
            message: 'Server returned invalid channels data',
            code: 422,
          },
        };
      }
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: {
            message: error.response?.data?.message || 'Failed to get channels',
            code: error.response?.status || 500,
          },
        };
      }
      return {
        success: false,
        error: { message: 'Unknown error', code: 500 },
      };
    }
  },
};
