import axios from "axios";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { convertKeysToCamelCase, convertKeysToSnakeCase } from "../utils/dataFormatter";

const axiosInstance = axios.create();

// Export the error type checker
const isAxiosError = axios.isAxiosError;

// Response interceptor: Transform responses to camelCase
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = convertKeysToCamelCase(response.data);
    }
    return response;
  },
  (error) => Promise.reject(error)
);

// Request interceptor: Transform outgoing requests to snake_case
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (config.data) {
      config.data = convertKeysToSnakeCase(config.data);
    }

    if (config.params) {
      config.params = convertKeysToSnakeCase(config.params);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export { axiosInstance, isAxiosError };
