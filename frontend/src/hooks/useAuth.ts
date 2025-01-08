import { useEffect, useState } from "react";
import { authApi } from "../api/authApi";

export const useAuth = () => {
  const [token, setToken] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  useEffect(() => {
    const storedToken = sessionStorage.getItem("token");
    const storedUsername = sessionStorage.getItem("username");

    if (!storedToken || !storedUsername) {
      setIsLoggedIn(false);
      return;
    }

    const validateLogin = async (): Promise<void> => {
      const response = await authApi.validateToken(storedToken);
      if (response.success) {
        setIsLoggedIn(true);
        setToken(storedToken);
        setUsername(storedUsername);
      } else {
        setIsLoggedIn(false);
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("username");
        setToken("");
        setUsername("");
      }
      return;
    };

    validateLogin();
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    try {
      const response = await authApi.login(username, password);
      if (response.success) {
        setToken(response.data.token);
        setUsername(username);
        setIsLoggedIn(true);
        sessionStorage.setItem("token", response.data.token);
        sessionStorage.setItem("username", username);
      } else {
        const serverErrorMessage = `${response.error?.message}, Code: ${response.error?.code}`;
        throw new Error(serverErrorMessage || "Login failed");
      }
    } catch (error) {
      console.error("Login failed:", error);
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
      } else {
        const serverErrorMessage = `${response.error?.message}, Code: ${response.error?.code}`;
        throw new Error(serverErrorMessage || "Server: Registration failed");
      }
    } catch (error) {
      console.error("Registration failed:", error);
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
      } else {
        const serverErrorMessage = `${response.error?.message}, Code: ${response.error?.code}`;
        throw new Error(serverErrorMessage || "Server: Logout failed");
      }
    } catch (error) {
      console.error("Logout failed:", error);
      setToken("");
      setUsername("");
      setIsLoggedIn(false);
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
      }
    } catch (error) {
      console.error("Delete account failed:", error);
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
