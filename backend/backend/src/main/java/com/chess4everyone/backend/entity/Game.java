package com.chess4everyone.backend.entity;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
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
}