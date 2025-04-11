import axios from "axios";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { convertKeysToCamelCase, convertKeysToSnakeCase } from "../utils/dataFormatter";

const axiosInstance = axios.create();

// Export the error type checker
const isAxiosError = axios.isAxiosError;

// Response interceptor: Transform responses to camelCase and handle ONLY 429 errors
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // Keep camelCase conversion for successful responses
    if (response.data) {
      response.data = convertKeysToCamelCase(response.data);
    }
    return response;
  },
  (error) => {
    // Check ONLY for Rate Limit Error (429)
    if (isAxiosError(error) && error.response?.status === 429) {
      console.error("Rate Limit Error (429) detected:", error);

      // Get message from response body (preferred) or create a default
      const message =
        error.response.data?.message ||
        error.response.data?.error ||
        error.response.data ||
        "Rate limit exceeded. Please try again later.";

      // Notify user directly using alert()
      alert(message);

      // Logout: Clear token and redirect
      console.log(`Logging out due to rate limit. Clearing token...`);
      sessionStorage.removeItem("token");

      // Redirect to login page
      // Use a small delay to allow the alert to be seen potentially
      setTimeout(() => {
        window.location.href = "/login";
      }, 50);

      // IMPORTANT: Stop error propagation by returning a resolved promise or nothing
      // This prevents the error from being caught by downstream .catch() blocks
      return new Promise(() => {}); // Return a pending promise that never resolves
      // effectively stopping the chain here for 429 errors.
    } else {
      // For ALL OTHER errors (including network errors, 401, 404, 500, etc.):
      // Simply re-reject the error to be handled by the calling code's catch block.
      return Promise.reject(error);
    }
  }
);

// Request interceptor: Keep snake_case conversion for outgoing requests
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
    // Keep default behavior for request errors
    return Promise.reject(error);
  }
);

export { axiosInstance, isAxiosError };
