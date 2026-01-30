import http, { httpLongRunning } from "./http";

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

export interface GameModeStatistics {
  modeName: string;           // "BULLET", "BLITZ", "RAPID", "CLASSICAL"
  displayName: string;        // "Bullet", "Blitz", "Rapid", "Classical"
  icon: string;               // Emoji icon ⚡, 🔥, ⚔️, 👑
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  drawRate: number;
  lossRate: number;
  averageAccuracy: number;
  totalTimeSpentMinutes: number;
}

export interface CategoryAnalysis {
  classification: "strong" | "average" | "weak";
  confidence: number;
  numericScore: 0 | 1 | 2;
}

export interface AnalysisResult {
  userId: string;
  timestamp: string;
  gamesAnalyzed: number;
  predictions: {
    opening: CategoryAnalysis;
    middlegame: CategoryAnalysis;
    endgame: CategoryAnalysis;
    tactical: CategoryAnalysis;
    positional: CategoryAnalysis;
    timeManagement: CategoryAnalysis;
  };
  strengths: string[];
  weaknesses: string[];
  features: {
    [key: string]: number;
  };
  recommendation: string;
}

export interface UserGamesAnalysisResponse {
  displayName: string;
  email: string;
  phone: string;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  analysisData?: AnalysisResult;
  lastAnalysisDate?: string;
}

export async function getUserInfo() {
  return http.get<UserInfo>("/api/profile/user-info");
}

export async function updateProfile(payload: UpdateProfilePayload) {
  return http.put<UserInfo>("/api/profile/update", payload);
}

/**
 * Fetch user's chess games analysis
 * Includes basic stats and AI-powered analysis if 10+ games available
 */
export async function getUserGamesAnalysis() {
  return http.get<UserGamesAnalysisResponse>("/api/profile/games-analysis");
}

/**
 * Update user's analysis with latest games
 * Triggers AI model analysis on 10 most recent games
 * Uses long timeout (2 minutes) as analysis can take time
 */
export async function updateUserAnalysis() {
  return httpLongRunning.post<UserGamesAnalysisResponse>("/api/profile/update-analysis", {});
}

/**
 * Get game mode statistics for user
 * Shows performance metrics for each game mode (Bullet, Blitz, Rapid, Classical)
 */
export async function getGameModeStatistics() {
  return http.get<GameModeStatistics[]>("/api/profile/game-modes");
}
