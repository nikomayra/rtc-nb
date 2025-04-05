import { AuthContext } from "../contexts/authContext";
import { useAuth } from "../hooks/useAuth";
import { useEffect } from "react";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const auth = useAuth();

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[AuthProvider] Mounted.");
    }
    return () => {
      if (import.meta.env.DEV) {
        console.log("[AuthProvider] Unmounting!");
      }
    };
  }, []);

  if (import.meta.env.DEV) {
    console.log("[AuthProvider] Rendering. Auth state:", auth);
  }

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};
