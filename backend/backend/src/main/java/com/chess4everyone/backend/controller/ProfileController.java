package com.chess4everyone.backend.controller;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

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
        System.out.println("🔍 Extracting user ID from request");
        
        String subject = null;
        if (req.getCookies() != null) {
            for (Cookie c : req.getCookies()) {
                if ("ch4e_access".equals(c.getName())) {
                    try {
                        subject = jwtService.parseToken(c.getValue()).getBody().getSubject();
                        System.out.println("✅ Token parsed, user ID: " + subject);
                    } catch (Exception e) {
                        System.out.println("❌ Token parsing failed: " + e.getMessage());
                    }
                }
            }
        }
        
        if (subject == null) {
            System.out.println("❌ No valid token found");
            return null;
        }
        
        return Long.valueOf(subject);
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getProfileStats(HttpServletRequest req) {
        System.out.println("📊 /stats endpoint called");
        
        Long userId = getUserIdFromRequest(req);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of(
                "error", "Unauthorized",
                "message", "Please log in to view profile"
            ));
        }

        try {
            User user = userRepo.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
            
            System.out.println("👤 Found user: " + user.getEmail());
            
            UserProfile profile = profileRepo.findByUserId(userId)
                .orElseGet(() -> {
                    System.out.println("⚠️ No profile found, creating default");
                    return createDefaultProfile(user);
                });

            // Format time played
            long hours = profile.getTimePlayedMinutes() / 60;
            long minutes = profile.getTimePlayedMinutes() % 60;
            String timePlayed = hours + "h " + minutes + "m";

            ProfileStatsDto stats = new ProfileStatsDto(
                user.getId(),
                user.getName(),
                user.getEmail().split("@")[0],
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

            System.out.println("✅ Returning profile stats for: " + user.getEmail());
            return ResponseEntity.ok(stats);
            
        } catch (Exception e) {
            System.out.println("❌ Error getting stats: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                "error", "Internal error",
                "message", "Failed to load profile stats"
            ));
        }
    }

    @GetMapping("/performance")
    public ResponseEntity<?> getPerformanceAreas(HttpServletRequest req) {
        System.out.println("📈 /performance endpoint called");
        
        Long userId = getUserIdFromRequest(req);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of(
                "error", "Unauthorized",
                "message", "Please log in to view performance"
            ));
        }

        try {
            User user = userRepo.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
            
            UserProfile profile = profileRepo.findByUserId(userId)
                .orElseGet(() -> createDefaultProfile(user));

            List<PerformanceAreaDto> areas = new ArrayList<>();
            areas.add(new PerformanceAreaDto("Opening", profile.getOpeningScore(), profile.getOpeningScoreChange()));
            areas.add(new PerformanceAreaDto("Middle Game", profile.getMiddleGameScore(), profile.getMiddleGameScoreChange()));
            areas.add(new PerformanceAreaDto("Endgame", profile.getEndgameScore(), profile.getEndgameScoreChange()));
            areas.add(new PerformanceAreaDto("Tactics", profile.getTacticsScore(), profile.getTacticsScoreChange()));
            areas.add(new PerformanceAreaDto("Time Management", profile.getTimeManagementScore(), profile.getTimeManagementScoreChange()));
            areas.add(new PerformanceAreaDto("Blunder Avoidance", profile.getBlunderAvoidanceScore(), profile.getBlunderAvoidanceScoreChange()));

            System.out.println("✅ Returning performance data");
            return ResponseEntity.ok(areas);
            
        } catch (Exception e) {
            System.out.println("❌ Error getting performance: " + e.getMessage());
            return ResponseEntity.status(500).body(Map.of(
                "error", "Internal error",
                "message", "Failed to load performance data"
            ));
        }
    }

    @GetMapping("/recent-games")
    public ResponseEntity<?> getRecentGames(HttpServletRequest req) {
        System.out.println("🎮 /recent-games endpoint called");
        
        Long userId = getUserIdFromRequest(req);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of(
                "error", "Unauthorized",
                "message", "Please log in to view games"
            ));
        }

        try {
            User user = userRepo.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
            
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

            System.out.println("✅ Returning " + recentGames.size() + " recent games");
            return ResponseEntity.ok(recentGames);
            
        } catch (Exception e) {
            System.out.println("❌ Error getting games: " + e.getMessage());
            return ResponseEntity.status(500).body(Map.of(
                "error", "Internal error",
                "message", "Failed to load games"
            ));
        }
    }

    private UserProfile createDefaultProfile(User user) {
        System.out.println("🆕 Creating default profile for: " + user.getEmail());
        
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