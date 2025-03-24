import { useEffect, useState, useRef } from "react";
import { authApi } from "../api/authApi";
import { useNotification } from "./useNotification";
import { isAxiosError } from "axios";

export const useAuth = () => {
  const [token, setToken] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const validationAttempted = useRef<boolean>(false);
  const { showError } = useNotification();

  // Token validation - only runs once on mount and when showError changes
  useEffect(() => {
    const storedToken = sessionStorage.getItem("token");
    const storedUsername = sessionStorage.getItem("username");

    // Skip if no stored credentials
    if (!storedToken || !storedUsername) {
      setIsLoggedIn(false);
      return;
    }

    // Track last validated token to prevent duplicate validations
    const lastValidatedToken = validationAttempted.current ? sessionStorage.getItem("lastValidatedToken") : null;

    // Skip validation if we've already validated this exact token
    if (lastValidatedToken === storedToken) {
      return;
    }

    // Track if component is mounted during async operation
    let isMounted = true;

    const validateLogin = async (): Promise<void> => {
      try {
        const response = await authApi.validateToken(storedToken);

        // Skip state updates if component unmounted
        if (!isMounted) return;

        if (response.success) {
          setIsLoggedIn(true);
          setToken(storedToken);
          setUsername(storedUsername);
          // Track which token was validated
          sessionStorage.setItem("lastValidatedToken", storedToken);
          validationAttempted.current = true;
        } else {
          showError("Login failed, invalid token");
          setIsLoggedIn(false);
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("username");
          sessionStorage.removeItem("lastValidatedToken");
          setToken("");
          setUsername("");
        }
      } catch (error) {
        // Skip state updates if component unmounted
        if (!isMounted) return;

        if (isAxiosError(error) && error.response?.status === 429) {
          console.warn("Rate limited on token validation. Using stored token without validation.");
          // Use the token anyway since we can't validate due to rate limiting
          setToken(storedToken);
          setUsername(storedUsername);
          setIsLoggedIn(true);
          // Even though we couldn't validate, we should track this to prevent retries
          sessionStorage.setItem("lastValidatedToken", storedToken);
          validationAttempted.current = true;
        } else {
          showError("Login failed, invalid token");
          setIsLoggedIn(false);
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("username");
          sessionStorage.removeItem("lastValidatedToken");
          setToken("");
          setUsername("");
        }
      }
    };

    // Execute validation
    validateLogin();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [showError]); // Only depends on showError, which is stable

  const login = async (username: string, password: string): Promise<void> => {
    try {
      const response = await authApi.login(username, password);
      if (response.success) {
        const newToken = response.data.token;
        setToken(newToken);
        setUsername(username);
        setIsLoggedIn(true);
        sessionStorage.setItem("token", newToken);
        sessionStorage.setItem("username", username);
        sessionStorage.setItem("lastValidatedToken", newToken); // Track the validated token
        validationAttempted.current = true; // Mark as validated on successful login
      } else {
        const errorMessage = response.error?.message || "Login failed";
        showError("Login failed");
        throw new Error(errorMessage);
      }
    } catch (error) {
      // Ensure we handle both Error objects and plain objects
      const errorMessage = error instanceof Error ? error.message : "Login failed";
      console.error(errorMessage);
      showError("Login failed");
      setToken("");
      setUsername("");
      setIsLoggedIn(false);
      sessionStorage.removeItem("lastValidatedToken");
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
        showError("Registration failed");
        throw new Error(errorMessage);
      }
    } catch (error) {
      // Ensure we handle both Error objects and plain objects
      const errorMessage = error instanceof Error ? error.message : "Registration failed";
      console.error(errorMessage);
      showError("Registration failed");
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
        sessionStorage.removeItem("lastValidatedToken"); // Clear the validated token
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
      sessionStorage.removeItem("lastValidatedToken");
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
