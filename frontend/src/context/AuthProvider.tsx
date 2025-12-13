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
      } catch (error) {
        console.warn("⚠️ AuthProvider - meApi() failed:", error);
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
      } finally {
        console.log("🏁 AuthProvider - Setting loading to false");
        setLoading(false);
      }
    })();
  }, []);

  const logout = async () => {
    await logoutApi();
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, setUser, loading, logout }}>
      {children}
    </Ctx.Provider>
  );
};

export default AuthProvider;
