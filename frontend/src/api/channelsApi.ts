import axios from 'axios';
import { APIResponse, Channel } from '../types/interfaces';
import { BASE_URL } from '../utils/constants';

export const channelsApi = {
  create: async (
    channelName: string,
    description: string,
    token: string
  ): Promise<APIResponse<Channel>> => {
    const res = await axios.post(
      `${BASE_URL}/createchannel`,
      { channelName, channelDescription: description },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  },

  join: async (
    channelName: string,
    token: string
  ): Promise<APIResponse<void>> => {
    const res = await axios.post(
      `${BASE_URL}/joinchannel`,
      { channelName, channelPassword: null },
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
