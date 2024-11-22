import axios from 'axios';
import { APIResponse, Channel } from '../types/interfaces';
import { BASE_URL } from '../utils/constants';

export const channelsApi = {
  create: async (
    channelName: string,
    description: string,
    password: string | undefined,
    token: string
  ): Promise<APIResponse<Channel>> => {
    const res = await axios.post(
      `${BASE_URL}/createchannel`,
      {
        channelName: channelName,
        channelDescription: description,
        channelPassword: password,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  },

  join: async (
    channelName: string,
    password: string | undefined,
    token: string
  ): Promise<APIResponse<void>> => {
    const res = await axios.post(
      `${BASE_URL}/joinchannel`,
      { channelName: channelName, channelPassword: password },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  },

  getAll: async (token: string): Promise<APIResponse<Channel[]>> => {
    const res = await axios.get(`${BASE_URL}/channels`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },
};
