import React, { createContext, useContext, useEffect, useState } from "react";
import { meApi, refreshApi, logoutApi } from "../api/auth";

type User = {
  id: number;
  name: string;
  email: string;
  phone?: string;
  provider: string;
} | null;

type AuthCtx = {
  user: User;
  loading: boolean;
  setUser: (u: User) => void;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  setUser: () => {},
  logout: async () => {},
  refetchUser: async () => {},
});

export const useAuth = () => useContext(Ctx);

const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      console.log("🔐 AuthProvider - Attempting meApi()");
      const { data } = await meApi();
      console.log("✅ AuthProvider - meApi() success:", data);
      setUser(data);
      return true;
    } catch (error: any) {
      console.warn("⚠️ AuthProvider - meApi() failed:", error?.response?.status);
      
      // Only try refresh if we got a 401 (not if network error)
      if (error?.response?.status === 401) {
        try {
          console.log("🔄 AuthProvider - Attempting refreshApi()");
          await refreshApi();
          console.log("✅ AuthProvider - refreshApi() success");
          
          // Try meApi again after refresh
          const { data } = await meApi();
          console.log("✅ AuthProvider - meApi() after refresh success:", data);
          setUser(data);
          return true;
        } catch (refreshError: any) {
          console.error("❌ AuthProvider - refreshApi() failed:", refreshError?.response?.status);
          setUser(null);
          return false;
        }
      } else {
        console.error("❌ AuthProvider - Network or other error:", error);
        setUser(null);
        return false;
      }
    }
  };

  useEffect(() => {
    (async () => {
      await fetchUser();
      console.log("🏁 AuthProvider - Setting loading to false");
      setLoading(false);
    })();
  }, []);

  const logout = async () => {
    try {
      await logoutApi();
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
      // Still clear user on error
      setUser(null);
    }
  };

  const refetchUser = async () => {
    setLoading(true);
    await fetchUser();
    setLoading(false);
  };

  return (
    <Ctx.Provider value={{ user, setUser, loading, logout, refetchUser }}>
      {children}
    </Ctx.Provider>
  );
};

export default AuthProvider;