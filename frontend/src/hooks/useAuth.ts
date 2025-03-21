import { useEffect, useState, useRef } from "react";
import { authApi } from "../api/authApi";
import { useNotification } from "./useNotification";
import { isAxiosError } from "axios";

export const useAuth = () => {
  const [token, setToken] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const validationAttempted = useRef<boolean>(false);
  const lastAttemptTime = useRef<number>(0);
  const throttleTime = 30000; // 30 seconds - match the throttle time in ChatProvider
  const { showError } = useNotification();

  useEffect(() => {
    const storedToken = sessionStorage.getItem("token");
    const storedUsername = sessionStorage.getItem("username");

    if (!storedToken || !storedUsername) {
      setIsLoggedIn(false);
      return;
    }

    // Prevent multiple validation attempts during a single session
    // Check time-based throttling as well
    const currentTime = Date.now();
    if (isValidating || validationAttempted.current || currentTime - lastAttemptTime.current < throttleTime) {
      return;
    }

    const validateLogin = async (): Promise<void> => {
      try {
        setIsValidating(true);
        validationAttempted.current = true;
        lastAttemptTime.current = currentTime;

        const response = await authApi.validateToken(storedToken);
        if (response.success) {
          setIsLoggedIn(true);
          setToken(storedToken);
          setUsername(storedUsername);
        } else {
          showError("Login failed, invalid token");
          setIsLoggedIn(false);
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("username");
          setToken("");
          setUsername("");
        }
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 429) {
          console.warn("Rate limited on token validation. Using stored token without validation.");
          // Use the token anyway since we can't validate due to rate limiting
          setToken(storedToken);
          setUsername(storedUsername);
          setIsLoggedIn(true);

          // Schedule a retry after throttle time
          setTimeout(() => {
            validationAttempted.current = false;
          }, throttleTime);
        } else {
          console.error("Error validating token:", error);
          setIsLoggedIn(false);
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("username");
          setToken("");
          setUsername("");
        }
      } finally {
        setIsValidating(false);
      }
    };

    validateLogin();
  }, [isValidating, showError]);

  const login = async (username: string, password: string): Promise<void> => {
    try {
      const response = await authApi.login(username, password);
      if (response.success) {
        setToken(response.data.token);
        setUsername(username);
        setIsLoggedIn(true);
        sessionStorage.setItem("token", response.data.token);
        sessionStorage.setItem("username", username);
        validationAttempted.current = true; // Mark as validated on successful login
      } else {
        const errorMessage = response.error?.message || "Login failed";
        showError(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      // Ensure we handle both Error objects and plain objects
      const errorMessage = error instanceof Error ? error.message : "Login failed";
      showError(errorMessage);
      setToken("");
      setUsername("");
      setIsLoggedIn(false);
      throw error;
    }
  };

  const register = async (username: string, password: string): Promise<void> => {
    try {
      const response = await authApi.register(username, password);
      if (response.success) {
        setToken(response.data.token);
        setUsername(username);
        setIsLoggedIn(true);
        sessionStorage.setItem("token", response.data.token);
        sessionStorage.setItem("username", username);
        validationAttempted.current = true; // Mark as validated on successful registration
      } else {
        const errorMessage = response.error?.message || "Registration failed";
        showError(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      // Ensure we handle both Error objects and plain objects
      const errorMessage = error instanceof Error ? error.message : "Registration failed";
      showError(errorMessage);
      setToken("");
      setUsername("");
      setIsLoggedIn(false);
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      const response = await authApi.logout(token);
      if (response.success) {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("username");
        setToken("");
        setUsername("");
        setIsLoggedIn(false);
        validationAttempted.current = false; // Reset validation on logout
      } else {
        const serverErrorMessage = `${response.error?.message}, Code: ${response.error?.code}`;
        throw new Error(serverErrorMessage || "Server: Logout failed");
      }
    } catch (error) {
      showError("Logout failed");
      setToken("");
      setUsername("");
      setIsLoggedIn(false);
      validationAttempted.current = false; // Reset validation on failed logout too
      throw error;
    }
  };

  const deleteAccount = async (): Promise<void> => {
    try {
      const response = await authApi.deleteAccount(token);
      if (response.success) {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("username");
        setToken("");
        setUsername("");
        setIsLoggedIn(false);
        validationAttempted.current = false; // Reset validation on account deletion
      }
    } catch (error) {
      showError("Delete account failed");
      throw error;
    }
  };

  return {
    state: {
      token,
      username,
      isLoggedIn,
    },
    actions: {
      login,
      register,
      logout,
      deleteAccount,
    },
  };
};
