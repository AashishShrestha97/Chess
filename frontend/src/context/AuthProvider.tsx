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
    console.log("🔐 AuthProvider - Starting fetchUser()");
    
    try {
      console.log("🔐 AuthProvider - Calling meApi()");
      const { data } = await meApi();
      console.log("✅ AuthProvider - meApi() success:", data);
      setUser(data);
      return true;
    } catch (error: any) {
      console.warn("⚠️ AuthProvider - meApi() failed");
      console.warn("   Status:", error?.response?.status);
      console.warn("   Message:", error?.message);
      
      // Only try refresh if we got a 401 (not if network error or other status)
      if (error?.response?.status === 401) {
        try {
          console.log("🔄 AuthProvider - Got 401, attempting refreshApi()");
          await refreshApi();
          console.log("✅ AuthProvider - refreshApi() success, retrying meApi()");
          
          // Try meApi again after refresh
          const { data } = await meApi();
          console.log("✅ AuthProvider - meApi() after refresh success:", data);
          setUser(data);
          return true;
        } catch (refreshError: any) {
          console.error("❌ AuthProvider - refreshApi() or retry failed");
          console.error("   Status:", refreshError?.response?.status);
          console.error("   Message:", refreshError?.message);
          setUser(null);
          return false;
        }
      } else {
        console.error("❌ AuthProvider - Non-401 error, clearing user");
        setUser(null);
        return false;
      }
    } finally {
      console.log("🏁 AuthProvider - fetchUser() complete");
    }
  };

  useEffect(() => {
    console.log("🚀 AuthProvider - Mounted, starting initial auth check");
    
    (async () => {
      await fetchUser();
      console.log("🏁 AuthProvider - Initial auth check complete, setting loading=false");
      setLoading(false);
    })();
  }, []);

  const logout = async () => {
    console.log("👋 AuthProvider - Logging out");
    try {
      await logoutApi();
      console.log("✅ AuthProvider - Logout API success");
      setUser(null);
    } catch (error) {
      console.error("❌ AuthProvider - Logout API error:", error);
      // Still clear user on error
      setUser(null);
    }
  };

  const refetchUser = async () => {
    console.log("🔄 AuthProvider - Manual refetch requested");
    setLoading(true);
    await fetchUser();
    setLoading(false);
    console.log("🏁 AuthProvider - Manual refetch complete");
  };

  // Log state changes for debugging
  useEffect(() => {
    console.log("📊 AuthProvider State Update:", { 
      user: user ? `User(id=${user.id}, name=${user.name})` : "null", 
      loading 
    });
  }, [user, loading]);

  return (
    <Ctx.Provider value={{ user, setUser, loading, logout, refetchUser }}>
      {children}
    </Ctx.Provider>
  );
};

export default AuthProvider;