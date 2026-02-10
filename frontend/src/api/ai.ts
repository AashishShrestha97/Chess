import http, { httpLongRunning } from "./http";

export type AIDifficulty = "EASY" | "INTERMEDIATE" | "HARD" | "MASTER" | "IMPOSSIBLE";

export interface GetAIMoveRequest {
  fen: string;
  difficulty: AIDifficulty;
}

export interface GetAIMoveResponse {
  move: string;
  evaluation: number;
  alternativeMove: string;
  alternativeEvaluation: number;
  bestContinuation: string;
}

// ML Analysis Types
export interface CategoryPrediction {
  classification: "excellent" | "good" | "average" | "weak";
  confidence: number; // 0.0 to 1.0
  numeric_score: number; // 0 to 100
}

export interface MLPredictions {
  opening: CategoryPrediction;
  middlegame: CategoryPrediction;
  endgame: CategoryPrediction;
  strategy: CategoryPrediction;
  tactical: CategoryPrediction;
  time_management: CategoryPrediction;
}

export interface PlayerAnalysisResponse {
  user_id: string;
  timestamp: string;
  games_analyzed: number;
  predictions: MLPredictions;
  strengths: string[];
  weaknesses: string[];
  features: Record<string, number>;
  recommendation: string;
}

const aiService = {
  /**
   * Get best move from AI opponent at specified difficulty
   */
  async getBestMove(fen: string, difficulty: AIDifficulty): Promise<GetAIMoveResponse> {
    try {
      const response = await http.post<GetAIMoveResponse>("/api/ai/move", {
        fen,
        difficulty,
      });
      return response.data;
    } catch (error) {
      console.error("❌ Failed to get AI move:", error);
      throw error;
    }
  },

  /**
   * Get position evaluation for analysis
   */
  async getEvaluation(fen: string): Promise<number> {
    try {
      const response = await http.post<{ evaluation: number }>("/api/ai/evaluate", {
        fen,
      });
      return response.data.evaluation;
    } catch (error) {
      console.error("❌ Failed to get evaluation:", error);
      throw error;
    }
  },

  /**
   * Check if AI engine is available
   */
  async checkEngineStatus(): Promise<boolean> {
    try {
      const response = await http.get<{ available: boolean }>("/api/ai/status");
      return response.data.available;
    } catch (error) {
      console.error("❌ Failed to check engine status:", error);
      return false;
    }
  },

  /**
   * Analyze player's games using ML models
   * Uses 10 most recent games to determine strength/weakness across different categories
   * Categories: opening, middlegame, endgame, strategy, tactical, time management
   */
  async analyzePlayerGames(): Promise<PlayerAnalysisResponse> {
    try {
      console.log("📊 Requesting ML analysis of player games...");
      const response = await httpLongRunning.get<PlayerAnalysisResponse>("/api/analysis/player");
      console.log("✅ Player analysis received:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ Failed to analyze player games:", error);
      throw error;
    }
  },

  /**
   * Get cached player analysis if available
   */
  async getPlayerAnalysisCached(): Promise<PlayerAnalysisResponse | null> {
    try {
      const response = await http.get<PlayerAnalysisResponse | null>(
        "/api/analysis/player/cached"
      );
      return response.data;
    } catch (error) {
      console.warn("⚠️ No cached analysis available:", error);
      return null;
    }
  },
};

export default aiService;
