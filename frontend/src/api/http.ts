import axios from "axios";

// Default to a relative base when running locally so Vite's proxy (configured
// in vite.config.ts) will forward requests to the backend and cookies behave
// as first-party. You can still set VITE_API_BASE in env to an absolute URL for
// other environments.
const baseURL = import.meta.env.VITE_API_BASE ?? "";

const http = axios.create({
  baseURL,
  withCredentials: true, // << send/receive httpOnly cookies
});

// --- Auto refresh access token on 401 then retry once
let isRefreshing = false;
let queue: Array<() => void> = [];

http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (!original) return Promise.reject(error);
    
    // Only retry if not already retried and not calling auth endpoints
    const isAuthEndpoint = original.url?.includes("/api/auth/");
    
    if (error?.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          await http.post("/api/auth/refresh");
          queue.forEach((fn) => fn());
          queue = [];
          return http(original);
        } catch {
          queue = [];
          // allow app to handle redirect to /login
          return Promise.reject(error);
        } finally {
          isRefreshing = false;
        }
      } else {
        return new Promise((resolve, reject) => {
          queue.push(() => {
            http(original).then(resolve).catch(reject);
          });
        });
      }
    }
    return Promise.reject(error);
  }
);

export default http;
