import http from "./http";

export interface ProfileStats {
  userId: number;
  name: string;
  username: string;
  rating: number;
  ratingChangeThisMonth: number;
  globalRank: number;
  gamesPlayed: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  timePlayed: string;
  favoriteOpening: string;
  wins: number;
  draws: number;
  losses: number;
}

export interface PerformanceArea {
  name: string;
  score: number;
  change: number;
}

export interface RecentGame {
  id: number;
  opponentName: string;
  result: string;
  ratingChange: number;
  accuracyPercentage: number;
  timeAgo: string;
}

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

export async function getProfileStats() {
  return http.get<ProfileStats>("/api/profile/stats");
}

export async function getPerformanceAreas() {
  return http.get<PerformanceArea[]>("/api/profile/performance");
}

export async function getRecentGames() {
  return http.get<RecentGame[]>("/api/profile/recent-games");
}

export async function getUserInfo() {
  return http.get<UserInfo>("/api/profile/user-info");
}

export async function updateProfile(payload: UpdateProfilePayload) {
  return http.put<UserInfo>("/api/profile/update", payload);
}
