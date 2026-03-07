import http from "./http";

export interface PlayerRankDto {
  rank: number;
  userId: number;
  name: string;
  rating: number;
  ratingChangeThisMonth: number;
  gamesPlayed: number;
  winRate: number;
  wins: number;
  losses: number;
  draws: number;
  currentStreak: number;
  bestStreak: number;
  isCurrentUser: boolean;
}

export interface RankingsResponse {
  globalRankings: PlayerRankDto[];
  currentUserRank: PlayerRankDto | null;
  totalPlayers: number;
}

export async function getGlobalRankings(page = 0, size = 50) {
  return http.get<RankingsResponse>(`/api/rankings?page=${page}&size=${size}`);
}

export async function searchPlayers(query: string) {
  return http.get<PlayerRankDto[]>(`/api/rankings/search?q=${encodeURIComponent(query)}`);
}