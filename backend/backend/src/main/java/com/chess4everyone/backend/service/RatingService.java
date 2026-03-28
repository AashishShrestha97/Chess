// backend/.../service/RatingService.java
package com.chess4everyone.backend.service;

import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
 * Called from {@link GameService#saveGame} and the multiplayer
 * {@link com.chess4everyone.backend.websocket.GameWebSocketHandler}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RatingService {

    private final Glicko2Service          glicko2;
    private final UserProfileRepository   profileRepo;
    private final RatingHistoryRepository historyRepo;

    /**
     * Update Glicko-2 ratings for both players after a completed game.
     *
     * @param whiteUser   white player entity
     * @param blackUser   black player entity
     * @param whiteResult "WIN", "LOSS", or "DRAW" (from white's perspective)
     * @param game        completed game entity (may be null for multiplayer games
     *                    that have not yet been persisted)
     */
    @Transactional
    public void updateRatings(
            User   whiteUser,
            User   blackUser,
            String whiteResult,
            Game   game) {

        // Load profiles (create defaults if missing)
        UserProfile whiteProfile = getOrCreate(whiteUser);
        UserProfile blackProfile = getOrCreate(blackUser);

        // Build PlayerState objects from stored Glicko-2 values
        Glicko2Service.PlayerState whiteState = new Glicko2Service.PlayerState(
                whiteProfile.getGlickoRating(),
                whiteProfile.getGlickoRd(),
                whiteProfile.getGlickoVolatility());

        Glicko2Service.PlayerState blackState = new Glicko2Service.PlayerState(
                blackProfile.getGlickoRating(),
                blackProfile.getGlickoRd(),
                blackProfile.getGlickoVolatility());

        // Determine score from white's perspective
        double whiteScore = switch (whiteResult.toUpperCase()) {
            case "WIN"  -> 1.0;
            case "DRAW" -> 0.5;
            default     -> 0.0;   // LOSS
        };

        // Run Glicko-2 calculation for both players
        Glicko2Service.UpdatedState[] updated =
                glicko2.calculateMatch(whiteState, blackState, whiteScore);

        Glicko2Service.UpdatedState newWhite = updated[0];
        Glicko2Service.UpdatedState newBlack = updated[1];

        log.info("Rating update — White {} {} → {:.1f} ({:+.1f}) | Black {} {} → {:.1f} ({:+.1f})",
                whiteUser.getName(), whiteResult,
                newWhite.newRating(), newWhite.ratingChange(),
                blackUser.getName(), whiteResult.equals("WIN") ? "LOSS" : (whiteResult.equals("LOSS") ? "WIN" : "DRAW"),
                newBlack.newRating(), newBlack.ratingChange());

        // Apply updates to profiles
        applyUpdate(whiteProfile, newWhite);
        applyUpdate(blackProfile, newBlack);

        profileRepo.save(whiteProfile);
        profileRepo.save(blackProfile);

        // Persist history entries
        saveHistory(whiteUser, whiteProfile, newWhite, game);
        saveHistory(blackUser, blackProfile, newBlack, game);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

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

    private void applyUpdate(UserProfile profile,
                             Glicko2Service.UpdatedState updated) {
        profile.setGlickoRating(updated.newRating());
        profile.setGlickoRd(updated.newRd());
        profile.setGlickoVolatility(updated.newVolatility());
        profile.setGlickoLastPeriod(Instant.now());

        // Also mirror into legacy integer rating field for backward compat
        profile.setRating((int) Math.round(updated.newRating()));
        profile.setRatingChangeThisMonth(
                profile.getRatingChangeThisMonth()
                        + (int) Math.round(updated.ratingChange()));
    }

    private void saveHistory(User user,
                             UserProfile profile,
                             Glicko2Service.UpdatedState updated,
                             Game game) {
        RatingHistory h = new RatingHistory();
        h.setUser(user);
        h.setRating(profile.getGlickoRating());
        h.setRd(profile.getGlickoRd());
        h.setVolatility(profile.getGlickoVolatility());
        h.setChange(updated.ratingChange());
        h.setGame(game);
        historyRepo.save(h);
    }
}