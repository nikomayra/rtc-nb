import { createContext } from 'react';

interface AuthContextType {
  isLoggedIn: boolean;
  token: string;
  username: string;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);
