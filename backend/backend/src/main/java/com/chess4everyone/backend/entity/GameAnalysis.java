package com.chess4everyone.backend.entity;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Stores comprehensive analysis of a chess game
 * including evaluations, blunders, best moves, etc.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "game_analysis")
public class GameAnalysis {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @OneToOne
    @JoinColumn(name = "game_id", nullable = false, unique = true)
    private Game game;
    
    @CreationTimestamp
    @Column(name = "analyzed_at")
    private Instant analyzedAt;
    
    // JSON array of move analysis: [{ moveNumber, san, evaluation, bestMove, isMistake, isBlunder, depth }]
    @Lob
    @Column(name = "moves_analysis", columnDefinition = "LONGTEXT")
    private String movesAnalysis;
    
    // Overall stats
    @Column(name = "white_accuracy")
    private Double whiteAccuracy = 0.0; // 0-100
    
    @Column(name = "black_accuracy")
    private Double blackAccuracy = 0.0; // 0-100
    
    @Column(name = "white_blunders")
    private Integer whiteBlunders = 0;
    
    @Column(name = "black_blunders")
    private Integer blackBlunders = 0;
    
    @Column(name = "white_mistakes")
    private Integer whiteMistakes = 0;
    
    @Column(name = "black_mistakes")
    private Integer blackMistakes = 0;
    
    // Best moves analysis
    @Lob
    @Column(name = "best_moves_by_phase", columnDefinition = "LONGTEXT")
    private String bestMovesByPhase; // JSON: { opening: [], middlegame: [], endgame: [] }
    
    // Key moments in game (mate threats, sacrifices, tactical opportunities)
    @Lob
    @Column(name = "key_moments", columnDefinition = "LONGTEXT")
    private String keyMoments; // JSON array of important positions
    
    // Opening info
    @Column(name = "opening_name")
    private String openingName;
    
    @Column(name = "opening_ply")
    private Integer openingPly; // How many plies until game leaves opening
    
    // Game phase analysis
    @Column(name = "opening_score_white")
    private Integer openingScoreWhite = 50;
    
    @Column(name = "opening_score_black")
    private Integer openingScoreBlack = 50;
    
    @Column(name = "middlegame_score_white")
    private Integer middlegameScoreWhite = 50;
    
    @Column(name = "middlegame_score_black")
    private Integer middlegameScoreBlack = 50;
    
    @Column(name = "endgame_score_white")
    private Integer endgameScoreWhite = 50;
    
    @Column(name = "endgame_score_black")
    private Integer endgameScoreBlack = 50;
}
