import { AuthContext } from '../../contexts/authContext';
import { useAuth } from '../../hooks/useAuth';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const auth = useAuth();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};
