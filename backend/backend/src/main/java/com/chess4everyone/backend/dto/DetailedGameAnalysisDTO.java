package com.chess4everyone.backend.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Detailed Game Analysis DTO
 * Contains move-by-move analysis with Stockfish evaluations
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DetailedGameAnalysisDTO {
    
    private Long gameId;
    private String whitePlayer;
    private String blackPlayer;
    private String result;
    private String opening;
    private int totalMoves;
    
    // Overall accuracy by phase
    private Double whiteAccuracy;
    private Double blackAccuracy;
    
    // Move classifications
    private int whiteBlunders;
    private int whiteMistakes;
    private int whiteInaccuracies;
    private int blackBlunders;
    private int blackMistakes;
    private int blackInaccuracies;
    
    // Detailed moves
    private List<MoveAnalysis> moves;
    
    // Key moments
    private List<KeyMoment> keyMoments;
    
    // Best moves by phase
    private String bestMovesOpening;
    private String bestMovesMiddlegame;
    private String bestMovesEndgame;
    
    // Analysis metadata
    private String analyzedAt;
    private String engine;
    private String engineVersion;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MoveAnalysis {
        private int moveNumber;
        private int plyCount;
        private String san; // Standard Algebraic Notation (e.g., "e4", "Nf3")
        private String from;
        private String to;
        private String promotionPiece;
        
        // Evaluations (in centipawns)
        private Double evaluationBefore;
        private Double evaluationAfter;
        private Double evaluationChange;
        
        // Move quality
        private boolean brilliant;
        private boolean excellent;
        private boolean good;
        private boolean inaccuracy;
        private boolean mistake;
        private boolean blunder;
        
        private String classification; // "Brilliant", "Excellent", "Good", "Inaccuracy", "Mistake", "Blunder"
        
        // Alternative moves
        private String bestMove;
        private Double bestMoveEval;
        private String secondBestMove;
        private Double secondBestEval;
        
        // Analysis details
        private String comment;
        private long analysisTimeMs;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KeyMoment {
        private int moveNumber;
        private String description;
        private Double evaluationChange;
        private String moveQuality;
        private String side; // "white" or "black"
    }
}
