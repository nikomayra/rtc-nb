import { axiosInstance } from "./axiosInstance";
import { APIResponse } from "../types/interfaces";
import { BASE_URL } from "../utils/constants";

export const authApi = {
  register: async (username: string, password: string): Promise<APIResponse<{ token: string; username: string }>> => {
    const res = await axiosInstance.post(`${BASE_URL}/register`, {
      username,
      password,
    });
    return res.data;
  },

  login: async (username: string, password: string): Promise<APIResponse<{ token: string; username: string }>> => {
    const res = await axiosInstance.post(`${BASE_URL}/login`, {
      username,
      password,
    });
    return res.data;
  },

  logout: async (token: string): Promise<APIResponse<{ message: string }>> => {
    const res = await axiosInstance.patch(`${BASE_URL}/logout`, null, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  deleteAccount: async (token: string): Promise<APIResponse<{ message: string }>> => {
    const res = await axiosInstance.delete(`${BASE_URL}/deleteaccount`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  validateToken: async (token: string): Promise<APIResponse<{ message: string }>> => {
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    const res = await axiosInstance.get(`${BASE_URL}/validatetoken`, { headers });
    return res.data;
  },
};
