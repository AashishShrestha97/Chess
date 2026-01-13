import http from "./http";

export interface UserInfo {
  id: number;
  name: string;
  email: string;
  phone?: string;
  provider: string;
}

export interface UpdateProfilePayload {
  name?: string;
  phone?: string;
}

export async function getUserInfo() {
  return http.get<UserInfo>("/api/profile/user-info");
}

export async function updateProfile(payload: UpdateProfilePayload) {
  return http.put<UserInfo>("/api/profile/update", payload);
}
