import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE ?? "/api";

const http = axios.create({
  baseURL,
  withCredentials: true, // << send/receive httpOnly cookies
  timeout: 30000, // 30 second default timeout for most requests
});

// Create a separate axios instance for long-running operations like analysis
export const httpLongRunning = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 120000, // 2 minute timeout for analysis and heavy computations
});

// --- Auto refresh access token on 401 then retry once
let isRefreshing = false;
let queue: Array<() => void> = [];

const setupInterceptors = (instance: typeof http) => {
  instance.interceptors.request.use(
    (config) => {
      console.log(`📤 HTTP ${config.method?.toUpperCase()} ${config.url}`);
      // Ensure API requests are identified as such (for backend to know not to redirect)
      config.headers['X-Requested-With'] = 'XMLHttpRequest';
      return config;
    },
    (error) => {
      console.error("❌ Request error:", error.message);
      return Promise.reject(error);
    }
  );

  instance.interceptors.response.use(
    (res) => {
      const url = res.config.url || "unknown";
      console.log(`✅ HTTP ${res.status} ${url}`, res.data);
      return res;
    },
    async (error) => {
      const original = error.config;
      if (!original) return Promise.reject(error);
      
      const url = original.url || "unknown";
      console.warn(`⚠️ HTTP ${error?.response?.status} ${url}:`, error?.response?.data?.message || error?.message);
      
      // Only retry if not already retried and not calling auth endpoints
      const isAuthEndpoint = original.url?.includes("/api/auth/");
      
      // Skip refresh for auth endpoints except refresh itself
      const isRefreshEndpoint = original.url?.includes("/api/auth/refresh");
      
      if (error?.response?.status === 401 && !original._retry && !isAuthEndpoint && !isRefreshEndpoint) {
        original._retry = true;

        if (!isRefreshing) {
          isRefreshing = true;
          try {
            console.log("🔄 Attempting token refresh...");
            // Use a separate instance to avoid circular refresh
            await axios.post(baseURL + "/api/auth/refresh", {}, { 
              withCredentials: true,
              timeout: 10000
            });
            console.log("✅ Token refresh successful");
            queue.forEach((fn) => fn());
            queue = [];
            return instance(original);
          } catch (refreshErr: any) {
            console.error("❌ Token refresh failed:", refreshErr?.response?.data?.message || refreshErr?.message);
            queue = [];
            // allow app to handle redirect to /login
            return Promise.reject(error);
          } finally {
            isRefreshing = false;
          }
        } else {
          return new Promise((resolve, reject) => {
            queue.push(() => {
              instance(original).then(resolve).catch(reject);
            });
          });
        }
      }
      return Promise.reject(error);
    }
  );
};

// Setup interceptors for both instances
setupInterceptors(http);
setupInterceptors(httpLongRunning);

export default http;