import http from "./http";

export interface RegisterPayload {
  name: string;
  phone?: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export async function registerApi(payload: RegisterPayload) {
  return http.post("/api/auth/register", payload);
}

export async function loginApi(email: string, password: string) {
  return http.post("/api/auth/login", { email, password });
}

export async function meApi() {
  return http.get("/api/auth/me");
}

export async function refreshApi() {
  return http.post("/api/auth/refresh");
}

export async function logoutApi() {
  return http.post("/api/auth/logout");
}

export function googleUrl() {
  const base = import.meta.env.VITE_API_BASE ?? "http://localhost:8080";
return `${base}/oauth2/authorization/google`;}
