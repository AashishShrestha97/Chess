import axios from "axios";

const API_BASE = "http://localhost:8080";

// ✅ CRITICAL: Create axios instance with credentials
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // This sends cookies with every request
});

// ===== AUTH ENDPOINTS =====
export const registerApi = (data: {
  name: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
}) => api.post("/api/auth/register", data);

export const loginApi = (email: string, password: string) =>
  api.post("/api/auth/login", { email, password });

export const meApi = () => api.get("/api/auth/me");

export const refreshApi = () => api.post("/api/auth/refresh");

export const logoutApi = () => api.post("/api/auth/logout");

export const googleUrl = () => `${API_BASE}/oauth2/authorization/google`;