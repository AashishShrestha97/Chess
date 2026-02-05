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

export const checkEmailApi = (email: string) => 
  http.get("/api/auth/check-email", { params: { email } });

export const googleUrl = () => {
  // Force account picker and consent screen every time
  // The prompt parameter with "select_account consent" forces Google to:
  // 1. Always show the account selection screen (select_account)
  // 2. Always show the consent screen (consent) - this prevents cached authorization
  const prompt = "select_account consent";
  
  return `${API_BASE}/oauth2/authorization/google?prompt=${prompt}`;
};