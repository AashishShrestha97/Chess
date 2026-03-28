// frontend/src/api/ratings.ts
import http from "./http";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RatingProfile {
  userId: number;
  name: string;
  glickoRating: number;
  glickoRd: number;
  glickoVolatility: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  globalRank: number;
}

export interface RatingHistoryEntry {
  id: number;
  rating: number;
  rd: number;
  change: number;
  recordedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  name: string;
  glickoRating: number;
  glickoRd: number;
  gamesPlayed: number;
  winRate: number;
  wins: number;
  losses: number;
  draws: number;
  currentStreak: number;
  isCurrentUser: boolean;
}

export interface LeaderboardResponse {
  rankings: LeaderboardEntry[];
  currentUserRank: LeaderboardEntry | null;
  totalPlayers: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Round Glicko-2 rating to nearest integer for display (like Chess.com). */
export const displayRating = (r: number): number => Math.round(r);

/**
 * RD confidence label.
 * RD < 75   → very reliable
 * RD < 110  → reliable
 * RD < 175  → provisional
 * else      → new player
 */
export const rdLabel = (rd: number): string => {
  if (rd < 75)  return "Established";
  if (rd < 110) return "Reliable";
  if (rd < 175) return "Provisional";
  return "New Player";
};

// ── API calls ─────────────────────────────────────────────────────────────────

/** Current user's Glicko-2 profile. */
export const getMyRating = () =>
  http.get<RatingProfile>("/api/ratings/me");

/** Last 20 rating history entries for current user (oldest first). */
export const getMyRatingHistory = () =>
  http.get<RatingHistoryEntry[]>("/api/ratings/me/history");

/** Any player's profile by userId. */
export const getPlayerRating = (userId: number) =>
  http.get<RatingProfile>(`/api/ratings/player/${userId}`);

/** Paginated global leaderboard. */
export const getLeaderboard = (page = 0, size = 50) =>
  http.get<LeaderboardResponse>(
    `/api/ratings/leaderboard?page=${page}&size=${size}`
  );