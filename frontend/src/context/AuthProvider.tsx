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
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  setUser: () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(Ctx);

const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        console.log("🔐 AuthProvider - Attempting meApi()");
        const { data } = await meApi();
        console.log("✅ AuthProvider - meApi() success:", data);
        setUser(data);
      } catch (error: any) {
        console.warn("⚠️ AuthProvider - meApi() failed, trying refresh...");
        
        // Only try refresh if we got a 401 (not if network error)
        if (error?.response?.status === 401) {
          try {
            console.log("🔄 AuthProvider - Attempting refreshApi()");
            await refreshApi();
            console.log("✅ AuthProvider - refreshApi() success");
            
            const { data } = await meApi();
            console.log("✅ AuthProvider - meApi() after refresh success:", data);
            setUser(data);
          } catch (refreshError) {
            console.error("❌ AuthProvider - refreshApi() failed:", refreshError);
            setUser(null);
          }
        } else {
          console.error("❌ AuthProvider - Network or other error:", error);
          setUser(null);
        }
      } finally {
        console.log("🏁 AuthProvider - Setting loading to false");
        setLoading(false);
      }
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

  return (
    <Ctx.Provider value={{ user, setUser, loading, logout }}>
      {children}
    </Ctx.Provider>
  );
};

export default AuthProvider;