package com.chess4everyone.backend.entity;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

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
 * Stores cached analysis results for a player.
 * This includes strengths, weaknesses, and various metrics.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "player_analysis")
public class PlayerAnalysis {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @OneToOne
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;
    
    @Lob
    @Column(name = "strengths", columnDefinition = "JSON")
    private String strengths; // JSON array of player strengths
    
    @Lob
    @Column(name = "weaknesses", columnDefinition = "JSON")
    private String weaknesses; // JSON array of player weaknesses
    
    @Lob
    @Column(name = "metrics", columnDefinition = "JSON")
    private String metrics; // JSON object of various metrics
    
    @Lob
    @Column(name = "predictions", columnDefinition = "JSON")
    private String predictions; // JSON object with category predictions (opening, middlegame, etc.)
    
    @Column(name = "games_analyzed")
    private Integer gamesAnalyzed = 0;
    
    @CreationTimestamp
    @Column(name = "analyzed_at")
    private Instant analyzedAt;
    
    @UpdateTimestamp
    private Instant updatedAt;
}
