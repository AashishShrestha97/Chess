package com.chess4everyone.backend.controller;

import java.util.ArrayList;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.chess4everyone.backend.dto.PerformanceAreaDto;
import com.chess4everyone.backend.dto.ProfileStatsDto;
import com.chess4everyone.backend.dto.RecentGameDto;
import com.chess4everyone.backend.entity.Game;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.entity.UserProfile;
import com.chess4everyone.backend.repo.UserRepository;
import com.chess4everyone.backend.repository.GameRepository;
import com.chess4everyone.backend.repository.UserProfileRepository;
import com.chess4everyone.backend.security.JwtService;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final UserRepository userRepo;
    private final UserProfileRepository profileRepo;
    private final GameRepository gameRepo;
    private final JwtService jwtService;

    public ProfileController(UserRepository userRepo, 
                           UserProfileRepository profileRepo,
                           GameRepository gameRepo,
                           JwtService jwtService) {
        this.userRepo = userRepo;
        this.profileRepo = profileRepo;
        this.gameRepo = gameRepo;
        this.jwtService = jwtService;
    }

    private Long getUserIdFromRequest(HttpServletRequest req) {
        String subject = null;
        if (req.getCookies() != null) {
            for (Cookie c : req.getCookies()) {
                if ("ch4e_access".equals(c.getName())) {
                    try {
                        subject = jwtService.parseToken(c.getValue()).getBody().getSubject();
                    } catch (Exception ignored) {}
                }
            }
        }
        if (subject == null) return null;
        return Long.valueOf(subject);
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getProfileStats(HttpServletRequest req) {
        Long userId = getUserIdFromRequest(req);
        if (userId == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        User user = userRepo.findById(userId).orElseThrow();
        UserProfile profile = profileRepo.findByUserId(userId)
            .orElseGet(() -> createDefaultProfile(user));

        // Format time played
        long hours = profile.getTimePlayedMinutes() / 60;
        long minutes = profile.getTimePlayedMinutes() % 60;
        String timePlayed = hours + "h " + minutes + "m";

        ProfileStatsDto stats = new ProfileStatsDto(
            user.getId(),
            user.getName(),
            user.getEmail().split("@")[0], // Use email prefix as username
            profile.getRating(),
            profile.getRatingChangeThisMonth(),
            profile.getGlobalRank(),
            profile.getGamesPlayed(),
            profile.getWinRate(),
            profile.getCurrentStreak(),
            profile.getBestStreak(),
            timePlayed,
            profile.getFavoriteOpening(),
            profile.getWins(),
            profile.getDraws(),
            profile.getLosses()
        );

        return ResponseEntity.ok(stats);
    }

    @GetMapping("/performance")
    public ResponseEntity<?> getPerformanceAreas(HttpServletRequest req) {
        Long userId = getUserIdFromRequest(req);
        if (userId == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        User user = userRepo.findById(userId).orElseThrow();
        UserProfile profile = profileRepo.findByUserId(userId)
            .orElseGet(() -> createDefaultProfile(user));

        List<PerformanceAreaDto> areas = new ArrayList<>();
        areas.add(new PerformanceAreaDto("Opening", profile.getOpeningScore(), profile.getOpeningScoreChange()));
        areas.add(new PerformanceAreaDto("Middle Game", profile.getMiddleGameScore(), profile.getMiddleGameScoreChange()));
        areas.add(new PerformanceAreaDto("Endgame", profile.getEndgameScore(), profile.getEndgameScoreChange()));
        areas.add(new PerformanceAreaDto("Tactics", profile.getTacticsScore(), profile.getTacticsScoreChange()));
        areas.add(new PerformanceAreaDto("Time Management", profile.getTimeManagementScore(), profile.getTimeManagementScoreChange()));
        areas.add(new PerformanceAreaDto("Blunder Avoidance", profile.getBlunderAvoidanceScore(), profile.getBlunderAvoidanceScoreChange()));

        return ResponseEntity.ok(areas);
    }

    @GetMapping("/recent-games")
    public ResponseEntity<?> getRecentGames(HttpServletRequest req) {
        Long userId = getUserIdFromRequest(req);
        if (userId == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        User user = userRepo.findById(userId).orElseThrow();
        List<Game> games = gameRepo.findTop5ByUserOrderByPlayedAtDesc(user);

        List<RecentGameDto> recentGames = games.stream()
            .map(game -> new RecentGameDto(
                game.getId(),
                game.getOpponentName(),
                game.getResult(),
                game.getRatingChange(),
                game.getAccuracyPercentage(),
                game.getTimeAgo()
            ))
            .toList();

        return ResponseEntity.ok(recentGames);
    }

    private UserProfile createDefaultProfile(User user) {
        UserProfile profile = new UserProfile();
        profile.setUser(user);
        profile.setRating(1200);
        profile.setRatingChangeThisMonth(0);
        profile.setGlobalRank(999999L);
        profile.setGamesPlayed(0);
        profile.setWinRate(0.0);
        profile.setCurrentStreak(0);
        profile.setBestStreak(0);
        profile.setTimePlayedMinutes(0L);
        profile.setFavoriteOpening("N/A");
        profile.setWins(0);
        profile.setDraws(0);
        profile.setLosses(0);
        return profileRepo.save(profile);
    }
}