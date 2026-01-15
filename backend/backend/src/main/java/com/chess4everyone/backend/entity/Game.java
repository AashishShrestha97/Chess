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
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "games")
public class Game {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    @ManyToOne
    @JoinColumn(name = "white_player_id")
    private User whitePlayer;
    
    @ManyToOne
    @JoinColumn(name = "black_player_id")
    private User blackPlayer;
    
    @Column(name = "opponent_name", nullable = false)
    private String opponentName;
    
    @Column(nullable = false)
    private String result; // "WIN", "LOSS", "DRAW"
    
    @Column(name = "rating_change")
    private Integer ratingChange = 0;
    
    @Column(name = "accuracy_percentage")
    private Integer accuracyPercentage;
    
    @Column(name = "game_duration")
    private String gameDuration; // e.g., "10+0", "5+3"
    
    @CreationTimestamp
    @Column(name = "played_at")
    private Instant playedAt;
    
    @Column(name = "time_ago")
    private String timeAgo; // e.g., "2 hours ago", "1 day ago"
    
    // New fields for detailed game recording
    @Lob
    @Column(name = "pgn", columnDefinition = "LONGTEXT")
    private String pgn; // Portable Game Notation
    
    @Lob
    @Column(name = "moves_json", columnDefinition = "LONGTEXT")
    private String movesJson; // JSON array of moves with FEN and metadata
    
    @Column(name = "white_rating")
    private Integer whiteRating = 1200;
    
    @Column(name = "black_rating")
    private Integer blackRating = 1200;
    
    @Column(name = "time_control")
    private String timeControl; // e.g., "3+0", "10+0"
    
    @Column(name = "opening_name")
    private String openingName; // e.g., "Sicilian Defense", "Ruy Lopez"
    
    @Column(name = "game_type")
    private String gameType; // "STANDARD", "VOICE", "RAPID", etc.
    
    @ManyToOne
    @JoinColumn(name = "game_mode_id")
    private GameMode gameMode; // Reference to game mode (BULLET, BLITZ, RAPID, CLASSICAL)
    
    @Column(name = "termination_reason")
    private String terminationReason; // "CHECKMATE", "RESIGNATION", "TIMEOUT", "STALEMATE", etc.
    
    @Column(name = "move_count")
    private Integer moveCount = 0;
    
    @Column(name = "total_time_white_ms")
    private Long totalTimeWhiteMs = 0L; // milliseconds spent
    
    @Column(name = "total_time_black_ms")
    private Long totalTimeBlackMs = 0L; // milliseconds spent
}