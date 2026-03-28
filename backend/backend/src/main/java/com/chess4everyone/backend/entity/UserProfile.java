// backend/.../entity/UserProfile.java  (replace existing file)
package com.chess4everyone.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter @Setter @NoArgsConstructor
@Table(name = "user_profiles")
public class UserProfile {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    // ── Legacy ELO (kept for backward compat) ────────────────────────────────
    @Column(nullable = false)
    private Integer rating = 1200;

    @Column(name = "rating_change_this_month")
    private Integer ratingChangeThisMonth = 0;

    @Column(name = "global_rank")
    private Long globalRank = 0L;

    // ── Glicko-2 ─────────────────────────────────────────────────────────────

    /** Glicko-2 public rating (μ on public scale).  Default 1500. */
    @Column(name = "glicko_rating", nullable = false)
    private Double glickoRating = 1500.0;

    /** Glicko-2 rating deviation (RD). Default 350 for new players. */
    @Column(name = "glicko_rd", nullable = false)
    private Double glickoRd = 350.0;

    /** Glicko-2 volatility (σ). Default 0.06. */
    @Column(name = "glicko_volatility", nullable = false)
    private Double glickoVolatility = 0.06;

    /** Timestamp of last rating period update (null = never played). */
    @Column(name = "glicko_last_period")
    private java.time.Instant glickoLastPeriod;

    // ── Stats ─────────────────────────────────────────────────────────────────
    @Column(name = "games_played") private Integer gamesPlayed = 0;
    @Column(name = "win_rate")     private Double  winRate     = 0.0;
    @Column(name = "current_streak") private Integer currentStreak = 0;
    @Column(name = "best_streak")    private Integer bestStreak    = 0;
    @Column(name = "time_played_minutes") private Long timePlayedMinutes = 0L;
    @Column(name = "favorite_opening")    private String favoriteOpening = "N/A";
    @Column(name = "wins")   private Integer wins   = 0;
    @Column(name = "draws")  private Integer draws  = 0;
    @Column(name = "losses") private Integer losses = 0;

    // ── Performance scores ────────────────────────────────────────────────────
    @Column(name = "opening_score")         private Integer openingScore        = 50;
    @Column(name = "middle_game_score")     private Integer middleGameScore     = 50;
    @Column(name = "endgame_score")         private Integer endgameScore        = 50;
    @Column(name = "tactics_score")         private Integer tacticsScore        = 50;
    @Column(name = "time_management_score") private Integer timeManagementScore = 50;
    @Column(name = "blunder_avoidance_score") private Integer blunderAvoidanceScore = 50;

    @Column(name = "opening_score_change")         private Integer openingScoreChange        = 0;
    @Column(name = "middle_game_score_change")      private Integer middleGameScoreChange     = 0;
    @Column(name = "endgame_score_change")          private Integer endgameScoreChange        = 0;
    @Column(name = "tactics_score_change")          private Integer tacticsScoreChange        = 0;
    @Column(name = "time_management_score_change")  private Integer timeManagementScoreChange = 0;
    @Column(name = "blunder_avoidance_score_change") private Integer blunderAvoidanceScoreChange = 0;
}