// backend/.../entity/RatingHistory.java
package com.chess4everyone.backend.entity;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter @Setter @NoArgsConstructor
@Table(name = "rating_history",
       indexes = @Index(name = "idx_rh_user_time",
                        columnList = "user_id, recorded_at DESC"))
public class RatingHistory {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false)
    private Double rating;

    @Column(nullable = false)
    private Double rd;

    @Column(nullable = false)
    private Double volatility;

    /** Signed rating change in this update (positive = gain). */
    @Column(nullable = false)
    private Double change = 0.0;

    @ManyToOne
    @JoinColumn(name = "game_id")
    private Game game;

    @CreationTimestamp
    @Column(name = "recorded_at", updatable = false)
    private Instant recordedAt;
}