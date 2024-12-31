import axiosInstance from './axiosInstance';
import { APIResponse } from '../types/interfaces';
import { BASE_URL } from '../utils/constants';

export const authApi = {
  register: async (
    username: string,
    password: string
  ): Promise<APIResponse<{ token: string; username: string }>> => {
    const res = await axiosInstance.post(`${BASE_URL}/register`, {
      username,
      password,
    });
    return res.data;
  },

  login: async (
    username: string,
    password: string
  ): Promise<APIResponse<{ token: string; username: string }>> => {
    const res = await axiosInstance.post(`${BASE_URL}/login`, {
      username,
      password,
    });
    return res.data;
  },

  logout: async (): Promise<APIResponse<{ message: string }>> => {
    const res = await axiosInstance.post(`${BASE_URL}/logout`);
    return res.data;
  },

  deleteAccount: async (): Promise<APIResponse<{ message: string }>> => {
    const res = await axiosInstance.delete(`${BASE_URL}/deleteaccount`);
    return res.data;
  },
};
