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

  const fetchUser = async (): Promise<boolean> => {
    console.log("🔐 AuthProvider - Starting fetchUser()");
    
    try {
      console.log("🔐 AuthProvider - Calling meApi()");
      console.log("🔐 AuthProvider - About to await meApi()...");
      
      const response = await meApi();
      
      console.log("✅ AuthProvider - meApi() returned");
      console.log("✅ AuthProvider - Full response:", response);
      console.log("✅ AuthProvider - response.data:", response.data);
      
      // The response from meApi should already be the user data (not wrapped in .data)
      const userData = response.data || response;
      console.log("✅ AuthProvider - Extracted user data:", userData);
      
      if (!userData || !userData.id) {
        console.warn("⚠️ AuthProvider - Invalid user data structure:", userData);
        setUser(null);
        return false;
      }
      
      const userObj = {
        id: userData.id,
        name: userData.name || "User",
        email: userData.email || "no-email@example.com", // Handle null email from Google OAuth
        phone: userData.phone,
        provider: userData.provider,
      };
      
      console.log("✅ AuthProvider - Setting user object:", userObj);
      setUser(userObj);
      console.log("✅ AuthProvider - User set successfully");
      return true;
    } catch (error: any) {
      console.error("❌ AuthProvider - fetchUser() caught error");
      console.error("   Error name:", error?.name);
      console.error("   Error message:", error?.message);
      console.error("   Error status:", error?.response?.status);
      console.error("   Error status text:", error?.response?.statusText);
      console.error("   Error data:", error?.response?.data);
      console.error("   Full error:", error);
      
      // Only try refresh if we got a 401
      if (error?.response?.status === 401) {
        try {
          console.log("🔄 AuthProvider - Got 401, attempting refreshApi()");
          await refreshApi();
          console.log("✅ AuthProvider - refreshApi() success, retrying meApi()");
          
          // Try meApi again after refresh
          try {
            const response = await meApi();
            console.log("✅ AuthProvider - meApi() after refresh success:", response);
            
            const userData = response.data || response;
            if (!userData || !userData.id) {
              console.warn("⚠️ AuthProvider - Invalid user data after refresh:", userData);
              setUser(null);
              return false;
            }
            
            const userObj = {
              id: userData.id,
              name: userData.name || "User",
              email: userData.email || "no-email@example.com",
              phone: userData.phone,
              provider: userData.provider,
            };
            
            setUser(userObj);
            return true;
          } catch (retryError: any) {
            console.error("❌ AuthProvider - meApi() retry after refresh failed");
            console.error("   Status:", retryError?.response?.status);
            setUser(null);
            return false;
          }
        } catch (refreshError: any) {
          console.error("❌ AuthProvider - refreshApi() failed");
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
    }
  };

  useEffect(() => {
    console.log("🚀 AuthProvider - Mounted, starting initial auth check");
    
    let isMounted = true;
    
    const initAuth = async () => {
      try {
        console.log("⏳ AuthProvider - initAuth() started");
        
        // Set a timeout for the entire authentication process
        const timeoutId = setTimeout(() => {
          if (isMounted) {
            console.error("❌ AuthProvider - Authentication timeout (10s), forcing completion");
            setLoading(false);
            setUser(null);
          }
        }, 10000); // 10 seconds timeout

        console.log("⏳ AuthProvider - About to call fetchUser()");
        const success = await fetchUser();
        console.log("🏁 AuthProvider - fetchUser() completed with result:", success);
        
        if (isMounted) {
          clearTimeout(timeoutId);
          console.log("🏁 AuthProvider - Clearing timeout and setting loading=false");
          setLoading(false);
        } else {
          console.warn("⚠️ AuthProvider - Component unmounted, not updating state");
        }
      } catch (error) {
        console.error("❌ AuthProvider - Unexpected error in initAuth():", error);
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };
    
    console.log("🚀 AuthProvider - Calling initAuth()");
    initAuth();
    
    return () => {
      console.log("🧹 AuthProvider - Cleanup, marking isMounted=false");
      isMounted = false;
    };
  }, []);

  const logout = async () => {
    console.log("👋 AuthProvider - Logging out");
    try {
      const response = await logoutApi();
      const provider = (response.data as any)?.provider || "LOCAL";
      
      console.log("✅ AuthProvider - Logout API success, provider:", provider);
      setUser(null);
      
      // ✅ If it's a Google account, redirect to Google logout
      if (provider === "GOOGLE") {
        console.log("🔐 AuthProvider - Google user detected, signing out from Google...");
        // Mark that we're logging out from Google so we force account picker on next login
        sessionStorage.setItem("google_logout", "true");
        
        // Use Google's logout endpoint with continue parameter
        // This clears the Google session and then redirects back to login
        const logoutUrl = `https://accounts.google.com/logout?continue=http://localhost:5173/login`;
        setTimeout(() => {
          window.location.href = logoutUrl;
        }, 500);
      }
    } catch (error) {
      console.error("❌ AuthProvider - Logout API error:", error);
      // Still clear user on error
      setUser(null);
    }
  };

  const refetchUser = async () => {
    console.log("🔄 AuthProvider - Manual refetch requested");
    setLoading(true);
    try {
      await fetchUser();
    } finally {
      setLoading(false);
      console.log("🏁 AuthProvider - Manual refetch complete");
    }
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