// backend/.../controller/RatingController.java
package com.chess4everyone.backend.controller;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.chess4everyone.backend.entity.RatingHistory;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.entity.UserProfile;
import com.chess4everyone.backend.repo.UserRepository;
import com.chess4everyone.backend.repository.RatingHistoryRepository;
import com.chess4everyone.backend.repository.UserProfileRepository;
import com.chess4everyone.backend.security.JwtService;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * REST endpoints for Glicko-2 rating data.
 *
 * GET  /api/ratings/me              → current user's Glicko-2 profile
 * GET  /api/ratings/me/history      → recent rating history (last 20 entries)
 * GET  /api/ratings/leaderboard     → all players sorted by glicko_rating DESC
 * GET  /api/ratings/player/{userId} → another player's rating profile
 */
@RestController
@RequestMapping("/api/ratings")
@RequiredArgsConstructor
@Slf4j
public class RatingController {

    private final UserRepository        userRepo;
    private final UserProfileRepository profileRepo;
    private final RatingHistoryRepository historyRepo;
    private final JwtService            jwtService;

    // ── DTOs ──────────────────────────────────────────────────────────────────

    public record RatingProfileDto(
            Long   userId,
            String name,
            double glickoRating,
            double glickoRd,
            double glickoVolatility,
            int    gamesPlayed,
            int    wins,
            int    losses,
            int    draws,
            double winRate,
            int    currentStreak,
            int    bestStreak,
            long   globalRank           // 1-based rank on leaderboard
    ) {}

    public record RatingHistoryDto(
            long   id,
            double rating,
            double rd,
            double change,
            String recordedAt
    ) {}

    public record LeaderboardEntryDto(
            long   rank,
            long   userId,
            String name,
            double glickoRating,
            double glickoRd,
            int    gamesPlayed,
            double winRate,
            int    wins,
            int    losses,
            int    draws,
            int    currentStreak,
            boolean isCurrentUser
    ) {}

    public record LeaderboardResponse(
            List<LeaderboardEntryDto> rankings,
            LeaderboardEntryDto       currentUserRank,
            long                      totalPlayers
    ) {}

    // ── Endpoints ─────────────────────────────────────────────────────────────

    /** Current user's full rating profile. */
    @GetMapping("/me")
    public ResponseEntity<?> getMyRating(HttpServletRequest req) {
        User user = extractUser(req);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        UserProfile p = profileRepo.findByUserId(user.getId())
                .orElseGet(() -> createDefaultProfile(user));

        return ResponseEntity.ok(toProfileDto(user, p, computeRank(p)));
    }

    /** Recent rating history for the current user (last 20 entries). */
    @GetMapping("/me/history")
    public ResponseEntity<?> getMyHistory(HttpServletRequest req) {
        User user = extractUser(req);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        List<RatingHistoryDto> history =
                historyRepo.findTop20ByUserOrderByRecordedAtDesc(user)
                        .stream()
                        .map(this::toHistoryDto)
                        .collect(Collectors.toList());
        // Return oldest-first for chart rendering
        Collections.reverse(history);
        return ResponseEntity.ok(history);
    }

    /** Any player's rating profile by user ID. */
    @GetMapping("/player/{userId}")
    public ResponseEntity<?> getPlayerRating(@PathVariable Long userId,
                                              HttpServletRequest req) {
        return userRepo.findById(userId)
                .map(user -> {
                    UserProfile p = profileRepo.findByUserId(userId)
                            .orElseGet(() -> createDefaultProfile(user));
                    return ResponseEntity.ok(toProfileDto(user, p, computeRank(p)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Global leaderboard — all players sorted by glicko_rating DESC.
     * Supports paging: ?page=0&size=50
     */
    @GetMapping("/leaderboard")
    public ResponseEntity<?> getLeaderboard(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "50") int size,
            HttpServletRequest req) {

        Long currentUserId = extractUserId(req);

        // Load ALL profiles sorted by rating for accurate rank assignment
        List<UserProfile> all = profileRepo.findAll().stream()
                .sorted(Comparator.comparingDouble(UserProfile::getGlickoRating).reversed())
                .collect(Collectors.toList());

        long total = all.size();

        // Page slice
        int from = page * size;
        int to   = Math.min(from + size, all.size());
        List<UserProfile> pageSlice = (from < all.size())
                ? all.subList(from, to)
                : List.of();

        List<LeaderboardEntryDto> entries = new ArrayList<>();
        for (int i = 0; i < pageSlice.size(); i++) {
            UserProfile p = pageSlice.get(i);
            long rank = (long) from + i + 1;
            entries.add(toLeaderboardEntry(p, rank, currentUserId));
        }

        // Current user's entry (always included regardless of page)
        LeaderboardEntryDto myEntry = null;
        if (currentUserId != null) {
            for (int i = 0; i < all.size(); i++) {
                if (all.get(i).getUser().getId().equals(currentUserId)) {
                    myEntry = toLeaderboardEntry(all.get(i), i + 1L, currentUserId);
                    break;
                }
            }
        }

        return ResponseEntity.ok(new LeaderboardResponse(entries, myEntry, total));
    }

    // ── Converters ────────────────────────────────────────────────────────────

    private RatingProfileDto toProfileDto(User user, UserProfile p, long rank) {
        return new RatingProfileDto(
                user.getId(),
                user.getName(),
                p.getGlickoRating()     != null ? p.getGlickoRating()     : 1500.0,
                p.getGlickoRd()         != null ? p.getGlickoRd()         : 350.0,
                p.getGlickoVolatility() != null ? p.getGlickoVolatility() : 0.06,
                p.getGamesPlayed()      != null ? p.getGamesPlayed()      : 0,
                p.getWins()             != null ? p.getWins()             : 0,
                p.getLosses()           != null ? p.getLosses()           : 0,
                p.getDraws()            != null ? p.getDraws()            : 0,
                p.getWinRate()          != null ? p.getWinRate()          : 0.0,
                p.getCurrentStreak()    != null ? p.getCurrentStreak()    : 0,
                p.getBestStreak()       != null ? p.getBestStreak()       : 0,
                rank);
    }

    private RatingHistoryDto toHistoryDto(RatingHistory h) {
        return new RatingHistoryDto(
                h.getId(),
                h.getRating(),
                h.getRd(),
                h.getChange(),
                h.getRecordedAt().toString());
    }

    private LeaderboardEntryDto toLeaderboardEntry(
            UserProfile p, long rank, Long currentUserId) {
        User u = p.getUser();
        return new LeaderboardEntryDto(
                rank,
                u.getId(),
                u.getName(),
                p.getGlickoRating()  != null ? p.getGlickoRating()  : 1500.0,
                p.getGlickoRd()      != null ? p.getGlickoRd()      : 350.0,
                p.getGamesPlayed()   != null ? p.getGamesPlayed()   : 0,
                p.getWinRate()       != null ? p.getWinRate()       : 0.0,
                p.getWins()          != null ? p.getWins()          : 0,
                p.getLosses()        != null ? p.getLosses()        : 0,
                p.getDraws()         != null ? p.getDraws()         : 0,
                p.getCurrentStreak() != null ? p.getCurrentStreak() : 0,
                currentUserId != null && currentUserId.equals(u.getId()));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** 1-based rank of this profile among all profiles. */
    private long computeRank(UserProfile target) {
        return profileRepo.findAll().stream()
                .filter(p -> p.getGlickoRating() != null
                        && p.getGlickoRating() > target.getGlickoRating())
                .count() + 1;
    }

    private UserProfile createDefaultProfile(User user) {
        UserProfile p = new UserProfile();
        p.setUser(user);
        p.setGlickoRating(1500.0);
        p.setGlickoRd(350.0);
        p.setGlickoVolatility(0.06);
        return profileRepo.save(p);
    }

    private User extractUser(HttpServletRequest req) {
        Long id = extractUserId(req);
        if (id == null) return null;
        return userRepo.findById(id).orElse(null);
    }

    private Long extractUserId(HttpServletRequest req) {
        if (req.getCookies() == null) return null;
        for (Cookie c : req.getCookies()) {
            if ("ch4e_access".equals(c.getName())) {
                try {
                    String sub = jwtService.parseToken(c.getValue())
                            .getBody().getSubject();
                    return Long.valueOf(sub);
                } catch (Exception ignored) {}
            }
        }
        return null;
    }
}