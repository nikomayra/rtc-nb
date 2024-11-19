import { useEffect, useState } from 'react';
import { authApi } from '../api/authApi';

export const useAuth = () => {
  const [token, setToken] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  useEffect(() => {
    const storedToken = sessionStorage.getItem('token');
    const storedUsername = sessionStorage.getItem('username');

    if (storedToken && storedUsername) {
      setToken(storedToken);
      setUsername(storedUsername);
      setIsLoggedIn(true);
    }
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    try {
      const response = await authApi.login(username, password);
      if (response.success && response.data) {
        setToken(response.data.token);
        setUsername(username);
        setIsLoggedIn(true);
        sessionStorage.setItem('token', response.data.token);
        sessionStorage.setItem('username', username);
      } else {
        const serverErrorMessage = `${response.error?.message}, Code: ${response.error?.code}`;
        throw new Error(serverErrorMessage || 'Login failed');
      }
    } catch (error) {
      console.error('Login failed:', error);
      setToken('');
      setUsername('');
      setIsLoggedIn(false);
      throw error;
    }
  };

  const register = async (
    username: string,
    password: string
  ): Promise<void> => {
    try {
      const response = await authApi.register(username, password);
      if (response.success && response.data) {
        setToken(response.data.token);
        setUsername(username);
        setIsLoggedIn(true);
        sessionStorage.setItem('token', response.data.token);
        sessionStorage.setItem('username', username);
      } else {
        const serverErrorMessage = `${response.error?.message}, Code: ${response.error?.code}`;
        throw new Error(serverErrorMessage || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration failed:', error);
      setToken('');
      setUsername('');
      setIsLoggedIn(false);
      throw error;
    }
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('username');
    setToken('');
    setUsername('');
    setIsLoggedIn(false);
  };

  return {
    token,
    username,
    isLoggedIn,
    login,
    register,
    logout,
  };
};
