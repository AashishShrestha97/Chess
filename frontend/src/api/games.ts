import http from "./http";

export interface SaveGamePayload {
  opponentName: string;
  result: "WIN" | "LOSS" | "DRAW";
  pgn: string;
  movesJson: string;
  whiteRating: number;
  blackRating: number;
  timeControl: string;
  gameType: "STANDARD" | "VOICE";
  terminationReason: string;
  moveCount: number;
  totalTimeWhiteMs: number;
  totalTimeBlackMs: number;
  accuracyPercentage: number;
}

export interface GameDetail {
  id: number;
  opponentName: string;
  result: string;
  gameType: string;
  timeControl: string;
  pgn: string;
  movesJson: string;
  moveCount: number;
  totalTimeWhiteMs: number;
  totalTimeBlackMs: number;
  whiteRating: number;
  blackRating: number;
  ratingChange: number;
  accuracyPercentage: number;
  terminationReason: string;
  playedAt: string;
}

export interface GameAnalysis {
  gameId: number;
  whiteAccuracy: number;
  blackAccuracy: number;
  whiteBlunders: number;
  blackBlunders: number;
  whiteMistakes: number;
  blackMistakes: number;
  movesAnalysis: string;
  bestMovesByPhase: string;
  keyMoments: string;
  openingName: string;
  openingPly: number;
  openingScoreWhite: number;
  openingScoreBlack: number;
  middlegameScoreWhite: number;
  middlegameScoreBlack: number;
  endgameScoreWhite: number;
  endgameScoreBlack: number;
}

export interface RecentGame {
  id: number;
  opponentName: string;
  result: string;
  ratingChange: number;
  accuracyPercentage: number;
  timeAgo: string;
}

const gameService = {
  /**
   * Save a completed game
   */
  async saveGame(payload: SaveGamePayload) {
    console.log("💾 Saving game...", payload);
    try {
      const response = await http.post("/api/games/save", payload);
      console.log("✅ Game saved:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ Failed to save game:", error);
      throw error;
    }
  },

  /**
   * Get detailed information about a game
   */
  async getGameDetail(gameId: number): Promise<GameDetail> {
    console.log("📖 Fetching game details for game:", gameId);
    try {
      const response = await http.get(`/api/games/${gameId}`);
      return response.data;
    } catch (error) {
      console.error("❌ Failed to get game details:", error);
      throw error;
    }
  },

  /**
   * Get analysis for a game
   */
  async getGameAnalysis(gameId: number): Promise<GameAnalysis> {
    console.log("🔍 Fetching analysis for game:", gameId);
    try {
      const response = await http.get(`/api/games/${gameId}/analysis`);
      return response.data;
    } catch (error) {
      console.error("❌ Failed to get game analysis:", error);
      throw error;
    }
  },

  /**
   * Get all games for the current user
   */
  async getUserAllGames() {
    console.log("📚 Fetching all user games...");
    try {
      const response = await http.get("/api/games/user/all");
      return response.data.games;
    } catch (error) {
      console.error("❌ Failed to get user games:", error);
      throw error;
    }
  },

  /**
   * Get recent games for the current user
   */
  async getUserRecentGames(limit: number = 10): Promise<RecentGame[]> {
    console.log("⏱️ Fetching recent user games...");
    try {
      const response = await http.get(`/api/games/user/recent/${limit}`);
      return response.data.games;
    } catch (error) {
      console.error("❌ Failed to get recent games:", error);
      throw error;
    }
  },
};

export default gameService;
