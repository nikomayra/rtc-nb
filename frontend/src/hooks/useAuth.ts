import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { authApi } from "../api/authApi";
import { useNotification } from "./useNotification";
import { isAxiosError } from "axios";
import { APIErrorResponse } from "../types/interfaces";

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

        if (!isMounted) return;

        if (response.success) {
          setIsLoggedIn(true);
          setToken(storedToken);
          setUsername(storedUsername);
          sessionStorage.setItem("lastValidatedToken", storedToken);
          validationAttempted.current = true;
        } else {
          showError("Login validation failed: Invalid token");
          setIsLoggedIn(false);
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("username");
          sessionStorage.removeItem("lastValidatedToken");
          setToken("");
          setUsername("");
        }
      } catch (error) {
        if (!isMounted) return;

        if (isAxiosError(error) && error.response?.status === 429) {
          console.warn("Rate limited on token validation. Using stored token without validation.");
          setToken(storedToken);
          setUsername(storedUsername);
          setIsLoggedIn(true);
          sessionStorage.setItem("lastValidatedToken", storedToken);
          validationAttempted.current = true;
        } else {
          const message = error instanceof Error ? error.message : "Token validation failed";
          showError(`Login validation failed: ${message}`);
          console.error("Token validation error:", error);
          setIsLoggedIn(false);
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("username");
          sessionStorage.removeItem("lastValidatedToken");
          setToken("");
          setUsername("");
        }
      }
    };

    validateLogin();

    return () => {
      isMounted = false;
    };
  }, [showError]); // Only depends on showError, which is stable

  const login = useCallback(async (usernameInput: string, passwordInput: string): Promise<void> => {
    try {
      const response = await authApi.login(usernameInput, passwordInput);
      if (response.success) {
        const newToken = response.data.token;
        setToken(newToken);
        setUsername(usernameInput);
        setIsLoggedIn(true);
        sessionStorage.setItem("token", newToken);
        sessionStorage.setItem("username", usernameInput);
        sessionStorage.setItem("lastValidatedToken", newToken);
        validationAttempted.current = true;
      } else {
        throw new Error((response as APIErrorResponse).error?.message || "Login failed: Unknown API error");
      }
    } catch (error) {
      setToken("");
      setUsername("");
      setIsLoggedIn(false);
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("username");
      sessionStorage.removeItem("lastValidatedToken");
      console.error("Login error:", error);
      if (isAxiosError(error)) {
        throw new Error(error.response?.data?.error?.message || "Login failed due to a network or server issue.");
      } else if (error instanceof Error) {
        throw new Error(error.message);
      } else {
        throw new Error("Login failed due to an unexpected error.");
      }
    }
  }, []);

  const register = useCallback(async (usernameInput: string, passwordInput: string): Promise<void> => {
    try {
      const response = await authApi.register(usernameInput, passwordInput);
      if (response.success) {
        setToken(response.data.token);
        setUsername(usernameInput);
        setIsLoggedIn(true);
        sessionStorage.setItem("token", response.data.token);
        sessionStorage.setItem("username", usernameInput);
        sessionStorage.setItem("lastValidatedToken", response.data.token);
        validationAttempted.current = true;
      } else {
        throw new Error((response as APIErrorResponse).error?.message || "Registration failed: Unknown API error");
      }
    } catch (error) {
      setToken("");
      setUsername("");
      setIsLoggedIn(false);
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("username");
      sessionStorage.removeItem("lastValidatedToken");
      console.error("Registration error:", error);
      if (isAxiosError(error)) {
        throw new Error(
          error.response?.data?.error?.message || "Registration failed due to a network or server issue."
        );
      } else if (error instanceof Error) {
        throw new Error(error.message);
      } else {
        throw new Error("Registration failed due to an unexpected error.");
      }
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    const previousToken = token;
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("lastValidatedToken");
    setToken("");
    setUsername("");
    setIsLoggedIn(false);
    validationAttempted.current = false;

    if (!previousToken) {
      console.warn("[useAuth] Logout called without a token.");
      return;
    }

    try {
      const response = await authApi.logout(previousToken);
      if (!response.success) {
        const apiError = response as APIErrorResponse;
        const serverErrorMessage = apiError.error?.message
          ? `${apiError.error.message}${apiError.error.code ? ` (Code: ${apiError.error.code})` : ""}`
          : "Server: Logout failed";
        throw new Error(serverErrorMessage);
      }
    } catch (error) {
      console.error("Logout error:", error);
      if (isAxiosError(error)) {
        throw new Error("Logout failed. Please try again.");
      } else if (error instanceof Error) {
        throw new Error(error.message);
      } else {
        throw new Error("Logout failed due to an unexpected error.");
      }
    }
  }, [token]);

  const deleteAccount = useCallback(async (): Promise<void> => {
    const currentToken = token;
    if (!currentToken) {
      throw new Error("Cannot delete account: No user logged in.");
    }

    try {
      const response = await authApi.deleteAccount(currentToken);
      if (response.success) {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("username");
        sessionStorage.removeItem("lastValidatedToken");
        setToken("");
        setUsername("");
        setIsLoggedIn(false);
        validationAttempted.current = false;
      } else {
        throw new Error((response as APIErrorResponse).error?.message || "Delete account failed: Unknown API error");
      }
    } catch (error) {
      console.error("Delete account error:", error);
      if (isAxiosError(error)) {
        throw new Error(
          error.response?.data?.error?.message || "Account deletion failed due to a network or server issue."
        );
      } else if (error instanceof Error) {
        throw new Error(error.message);
      } else {
        throw new Error("Account deletion failed due to an unexpected error.");
      }
    }
  }, [token]);

  // Memoize the state object
  const state = useMemo(
    () => ({
      token,
      username,
      isLoggedIn,
    }),
    [token, username, isLoggedIn]
  );

  // Memoize the actions object
  const actions = useMemo(
    () => ({
      login,
      register,
      logout,
      deleteAccount,
    }),
    [login, register, logout, deleteAccount]
  );

  // Memoize the final returned object
  return useMemo(
    () => ({
      state,
      actions,
    }),
    [state, actions]
  );
};
