import http from "./http";

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
};

export default aiService;
