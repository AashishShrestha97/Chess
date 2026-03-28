package com.chess4everyone.backend.service;

import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.chess4everyone.backend.entity.Game;
import com.chess4everyone.backend.entity.RatingHistory;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.entity.UserProfile;
import com.chess4everyone.backend.repository.RatingHistoryRepository;
import com.chess4everyone.backend.repository.UserProfileRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Orchestrates Glicko-2 rating updates after each completed game.
 *
 * FIXED:
 * 1. Uses TransactionTemplate so @Transactional works correctly from background threads.
 * 2. Added updateSoloRating() for AI games (human vs fixed AI state, not human vs human).
 * 3. Fixed SLF4J log format — replaced {:.1f}/{:+.1f} with String.format() calls.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RatingService {

    private final Glicko2Service          glicko2;
    private final UserProfileRepository   profileRepo;
    private final RatingHistoryRepository historyRepo;
    private final PlatformTransactionManager txManager;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Update Glicko-2 ratings for both players after a completed multiplayer game.
     *
     * Safe to call from a background thread — uses TransactionTemplate internally.
     *
     * @param whiteUser   white player entity
     * @param blackUser   black player entity
     * @param whiteResult "WIN", "LOSS", or "DRAW" from white's perspective
     * @param game        completed game entity (may be null)
     */
    public void updateRatings(User whiteUser, User blackUser, String whiteResult, Game game) {
        new TransactionTemplate(txManager).execute(status -> {
            try {
                UserProfile whiteProfile = getOrCreate(whiteUser);
                UserProfile blackProfile = getOrCreate(blackUser);

                Glicko2Service.PlayerState whiteState = toPlayerState(whiteProfile);
                Glicko2Service.PlayerState blackState = toPlayerState(blackProfile);

                double whiteScore = resultToScore(whiteResult);

                Glicko2Service.UpdatedState[] updated =
                        glicko2.calculateMatch(whiteState, blackState, whiteScore);

                Glicko2Service.UpdatedState newWhite = updated[0];
                Glicko2Service.UpdatedState newBlack = updated[1];

                String blackResult = invertResult(whiteResult);

                log.info("Rating update — White {} ({}) -> {} ({}) | Black {} ({}) -> {} ({})",
                        whiteUser.getName(), whiteResult,
                        String.format("%.1f", newWhite.newRating()),
                        String.format("%+.1f", newWhite.ratingChange()),
                        blackUser.getName(), blackResult,
                        String.format("%.1f", newBlack.newRating()),
                        String.format("%+.1f", newBlack.ratingChange()));

                applyUpdate(whiteProfile, newWhite);
                applyUpdate(blackProfile, newBlack);

                profileRepo.save(whiteProfile);
                profileRepo.save(blackProfile);

                saveHistory(whiteUser, whiteProfile, newWhite, game);
                saveHistory(blackUser, blackProfile, newBlack, game);

            } catch (Exception e) {
                log.error("Error updating ratings for {} vs {}: {}",
                        whiteUser.getName(), blackUser.getName(), e.getMessage(), e);
                status.setRollbackOnly();
            }
            return null;
        });
    }

    /**
     * Update rating for a solo (vs AI) game.
     *
     * Uses a fixed "AI" opponent modelled as a 1500-rated player with RD=200.
     * This means winning against the AI gives a small positive change, and losing
     * gives a small negative change — realistic for ladder-style progress.
     *
     * Safe to call from a background thread.
     *
     * @param user   the human player
     * @param result "WIN", "LOSS", or "DRAW" from the human's perspective
     * @param game   completed game entity (may be null)
     */
    public void updateSoloRating(User user, String result, Game game) {
        new TransactionTemplate(txManager).execute(status -> {
            try {
                UserProfile profile = getOrCreate(user);
                Glicko2Service.PlayerState playerState = toPlayerState(profile);

                // Fixed AI opponent — 1500 rating, 200 RD (unestablished opponent)
                Glicko2Service.PlayerState aiState =
                        new Glicko2Service.PlayerState(1500.0, 200.0, 0.06);

                double score = resultToScore(result);

                Glicko2Service.GameResult gameResult =
                        new Glicko2Service.GameResult(aiState.rating(), aiState.rd(), score);

                Glicko2Service.UpdatedState updated =
                        glicko2.calculate(playerState, List.of(gameResult));

                log.info("Solo rating update — {} ({}) -> {} ({})",
                        user.getName(), result,
                        String.format("%.1f", updated.newRating()),
                        String.format("%+.1f", updated.ratingChange()));

                applyUpdate(profile, updated);
                profileRepo.save(profile);
                saveHistory(user, profile, updated, game);

            } catch (Exception e) {
                log.error("Error updating solo rating for {}: {}", user.getName(), e.getMessage(), e);
                status.setRollbackOnly();
            }
            return null;
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private UserProfile getOrCreate(User user) {
        return profileRepo.findByUserId(user.getId()).orElseGet(() -> {
            UserProfile p = new UserProfile();
            p.setUser(user);
            p.setGlickoRating(Glicko2Service.DEFAULT_RATING);
            p.setGlickoRd(Glicko2Service.DEFAULT_RD);
            p.setGlickoVolatility(Glicko2Service.DEFAULT_VOLATILITY);
            return profileRepo.save(p);
        });
    }

    private Glicko2Service.PlayerState toPlayerState(UserProfile p) {
        return new Glicko2Service.PlayerState(
                p.getGlickoRating()     != null ? p.getGlickoRating()     : Glicko2Service.DEFAULT_RATING,
                p.getGlickoRd()         != null ? p.getGlickoRd()         : Glicko2Service.DEFAULT_RD,
                p.getGlickoVolatility() != null ? p.getGlickoVolatility() : Glicko2Service.DEFAULT_VOLATILITY
        );
    }

    private void applyUpdate(UserProfile profile, Glicko2Service.UpdatedState updated) {
        profile.setGlickoRating(updated.newRating());
        profile.setGlickoRd(updated.newRd());
        profile.setGlickoVolatility(updated.newVolatility());
        profile.setGlickoLastPeriod(Instant.now());

        // Mirror into legacy integer field for backward compat
        profile.setRating((int) Math.round(updated.newRating()));
        profile.setRatingChangeThisMonth(
                profile.getRatingChangeThisMonth() + (int) Math.round(updated.ratingChange()));
    }

    private void saveHistory(User user, UserProfile profile,
                             Glicko2Service.UpdatedState updated, Game game) {
        RatingHistory h = new RatingHistory();
        h.setUser(user);
        h.setRating(profile.getGlickoRating());
        h.setRd(profile.getGlickoRd());
        h.setVolatility(profile.getGlickoVolatility());
        h.setChange(updated.ratingChange());
        h.setGame(game);
        historyRepo.save(h);
    }

    private double resultToScore(String result) {
        return switch (result.toUpperCase()) {
            case "WIN"  -> 1.0;
            case "DRAW" -> 0.5;
            default     -> 0.0;
        };
    }

    private String invertResult(String result) {
        return switch (result.toUpperCase()) {
            case "WIN"  -> "LOSS";
            case "LOSS" -> "WIN";
            default     -> "DRAW";
        };
    }
}