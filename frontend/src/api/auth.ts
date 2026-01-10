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
  // Force account picker if user just logged out from Google
  // The prompt=select_account parameter tells Google to show the account picker
  const hasJustLoggedOut = sessionStorage.getItem("google_logout") === "true";
  const prompt = hasJustLoggedOut ? "select_account" : "select_account"; // Always force select_account
  
  // Clear the logout flag after using it
  if (hasJustLoggedOut) {
    sessionStorage.removeItem("google_logout");
  }
  
  return `${API_BASE}/oauth2/authorization/google?prompt=${prompt}`;
};