import http from "./http";

const API_BASE = "http://localhost:8080";

// ===== AUTH ENDPOINTS =====
export const registerApi = (data: {
  name: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
}) => http.post("/api/auth/register", data);

export const loginApi = (email: string, password: string) =>
  http.post("/api/auth/login", { email, password });

export const meApi = () => http.get("/api/auth/me");

export const refreshApi = () => http.post("/api/auth/refresh");

export const logoutApi = () => http.post("/api/auth/logout");

export const googleUrl = () => `${API_BASE}/oauth2/authorization/google`;