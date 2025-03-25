import axios from "axios";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { convertKeysToCamelCase, convertKeysToSnakeCase } from "../utils/dataFormatter";

// Extend AxiosRequestConfig to include requestId
declare module "axios" {
  export interface InternalAxiosRequestConfig {
    requestId?: string;
  }
}

const axiosInstance = axios.create();

// Export the error type checker
const isAxiosError = axios.isAxiosError;

// Track recent errors to avoid duplicate notifications
const recentErrors = new Map<string, number>();
const ERROR_DEBOUNCE_TIME = 3000; // 3 seconds

// Response interceptor: Transform responses to camelCase
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = convertKeysToCamelCase(response.data);
    }
    return response;
  },
  (error) => {
    // Handle errors globally here
    // We'll use a custom event to trigger notifications instead of directly importing the hook
    // This avoids circular dependencies
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const status = error.response.status;
      const url = error.config?.url || "unknown";
      const errorKey = `${url}:${status}`;
      const errorData = error.response.data;
      const now = Date.now();

      // Check if we've shown this error recently
      if (recentErrors.has(errorKey)) {
        const lastTime = recentErrors.get(errorKey) || 0;
        if (now - lastTime < ERROR_DEBOUNCE_TIME) {
          // Skip notification for duplicate errors
          return Promise.reject(error);
        }
      }

      // Update the error timestamp
      recentErrors.set(errorKey, now);

      // Clean up old entries after some time
      setTimeout(() => {
        recentErrors.delete(errorKey);
      }, ERROR_DEBOUNCE_TIME);

      let errorMessage = "An error occurred during the request";

      // Rate limiting errors (429 Too Many Requests)
      if (status === 429) {
        errorMessage = "Rate limit exceeded. Please wait before trying again.";
      }
      // Authentication errors
      else if (status === 401 || status === 403) {
        errorMessage = "Authentication failed. Please log in again.";
      }
      // Not found errors
      else if (status === 404) {
        errorMessage = "The requested resource was not found.";
      }
      // Server errors
      else if (status >= 500) {
        errorMessage = "Server error. Please try again later.";
      }
      // Use error message from server if available
      else if (errorData && (errorData.message || errorData.error)) {
        errorMessage = errorData.message || errorData.error || errorMessage;
      }

      // Dispatch a custom event for the notification system to pick up
      const errorEvent = new CustomEvent("api-error", {
        detail: {
          message: errorMessage,
          status,
          url: error.config?.url || "unknown endpoint",
        },
      });
      window.dispatchEvent(errorEvent);
    } else if (error.request) {
      // The request was made but no response was received
      const url = error.config?.url || "unknown";
      const errorKey = `${url}:network`;
      const now = Date.now();

      // Check if we've shown this error recently
      if (recentErrors.has(errorKey)) {
        const lastTime = recentErrors.get(errorKey) || 0;
        if (now - lastTime < ERROR_DEBOUNCE_TIME) {
          // Skip notification for duplicate errors
          return Promise.reject(error);
        }
      }

      // Update the error timestamp
      recentErrors.set(errorKey, now);

      // Clean up old entries after some time
      setTimeout(() => {
        recentErrors.delete(errorKey);
      }, ERROR_DEBOUNCE_TIME);

      const errorEvent = new CustomEvent("api-error", {
        detail: {
          message: "No response received from server. Please check your connection.",
          url: error.config?.url || "unknown endpoint",
        },
      });
      window.dispatchEvent(errorEvent);
    }

    return Promise.reject(error);
  }
);

// Request interceptor: Transform outgoing requests to snake_case and track loading
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
  (error) => {
    return Promise.reject(error);
  }
);

export { axiosInstance, isAxiosError };
