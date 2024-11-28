import { createContext } from 'react';

interface AuthState {
  isLoggedIn: boolean;
  token: string;
  username: string;
}

interface AuthContextType {
  state: AuthState;
  actions: {
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string) => Promise<void>;
    logout: () => void;
  };
}

export const AuthContext = createContext<AuthContextType | null>(null);
