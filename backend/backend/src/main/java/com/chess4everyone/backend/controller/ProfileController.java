package com.chess4everyone.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.chess4everyone.backend.dto.UpdateProfileRequest;
import com.chess4everyone.backend.dto.UserGamesAnalysisDto;
import com.chess4everyone.backend.dto.UserResponse;
import com.chess4everyone.backend.dto.GameModeStatisticsDto;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.entity.GameMode;
import com.chess4everyone.backend.repo.UserRepository;
import com.chess4everyone.backend.security.JwtService;
import com.chess4everyone.backend.service.GameAnalysisService;
import com.chess4everyone.backend.service.GameModeService;
import com.chess4everyone.backend.repository.GameRepository;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final UserRepository userRepo;
    private final JwtService jwtService;
    private final GameAnalysisService gameAnalysisService;
    private final GameModeService gameModeService;
    private final GameRepository gameRepository;

    private Long getUserIdFromRequest(HttpServletRequest req) {
        log.debug("🔍 Extracting user ID from request");
        
        // Log all cookies
        if (req.getCookies() != null) {
            log.debug("🍪 Total cookies: " + req.getCookies().length);
            for (Cookie cookie : req.getCookies()) {
                log.debug("  Cookie: " + cookie.getName());
            }
        } else {
            log.debug("⚠️ No cookies in request");
        }
        
        String subject = null;
        if (req.getCookies() != null) {
            for (Cookie c : req.getCookies()) {
                if ("ch4e_access".equals(c.getName())) {
                    try {
                        subject = jwtService.parseToken(c.getValue()).getBody().getSubject();
                        log.debug("✅ Token parsed, user ID: " + subject);
                    } catch (Exception e) {
                        log.error("❌ Token parsing failed: " + e.getMessage(), e);
                    }
                }
            }
        }
        
        if (subject == null) {
            log.debug("❌ No valid token found");
            return null;
        }
        
        return Long.valueOf(subject);
    }

    @PutMapping("/update")
    public ResponseEntity<?> updateProfile(HttpServletRequest req, @RequestBody UpdateProfileRequest updateRequest) {
        try {
            log.info("📝 Update profile request received");
            log.info("   Request name: " + updateRequest.name());
            log.info("   Request phone: " + updateRequest.phone());
            
            Long userId = getUserIdFromRequest(req);
            if (userId == null) {
                log.warn("⚠️ No valid user ID in request");
                return ResponseEntity.status(401).body("Unauthorized");
            }

            log.info("👤 Updating profile for user ID: " + userId);
            
            User user = userRepo.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
            
            log.info("   Current name: " + user.getName());
            log.info("   Current phone: " + user.getPhone());

            // Update name if provided
            if (updateRequest.name() != null && !updateRequest.name().trim().isEmpty()) {
                log.info("   Setting new name: " + updateRequest.name().trim());
                user.setName(updateRequest.name().trim());
            }

            // Update phone if provided (set to null if empty)
            if (updateRequest.phone() != null) {
                if (!updateRequest.phone().trim().isEmpty()) {
                    log.info("   Setting new phone: " + updateRequest.phone().trim());
                    user.setPhone(updateRequest.phone().trim());
                } else {
                    log.info("   Clearing phone (setting to null)");
                    user.setPhone(null);
                }
            }

            @SuppressWarnings("null")
            User saved = userRepo.save(user);
            
            log.info("✅ Profile saved for user: " + userId);
            log.info("   New name: " + saved.getName());
            log.info("   New phone: " + saved.getPhone());

            // Return updated user info
            UserResponse response = new UserResponse(
                saved.getId(),
                saved.getName(),
                saved.getEmail(),
                saved.getPhone(),
                saved.getProvider()
            );

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("❌ Error updating profile: " + e.getMessage());
            log.error("   Exception type: " + e.getClass().getName());
            log.error("   Stack trace: ", e);
            return ResponseEntity.status(500).body("Error updating profile: " + e.getMessage());
        }
    }

    @GetMapping("/user-info")
    public ResponseEntity<?> getUserInfo(HttpServletRequest req) {
        Long userId = getUserIdFromRequest(req);
        if (userId == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        User user = userRepo.findById(userId).orElseThrow();

        UserResponse response = new UserResponse(
            user.getId(),
            user.getName(),
            user.getEmail(),
            user.getPhone(),
            user.getProvider()
        );

        return ResponseEntity.ok(response);
    }

    /**
     * Get user's games analysis with AI-powered insights
     * Returns game statistics and analysis if 10+ games available
     */
    @GetMapping("/games-analysis")
    public ResponseEntity<?> getGamesAnalysis(HttpServletRequest req) {
        Long userId = getUserIdFromRequest(req);
        if (userId == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        try {
            User user = userRepo.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            
            UserGamesAnalysisDto analysis = gameAnalysisService.getUserGamesAnalysis(user);
            return ResponseEntity.ok(analysis);
        } catch (Exception e) {
            log.error("Error fetching games analysis: ", e);
            return ResponseEntity.status(500).body("Error fetching analysis data");
        }
    }

    /**
     * Update user's analysis with latest games
     * Analyzes 10 most recent games using AI models
     * Requires at least 10 games to be played
     */
    @PostMapping("/update-analysis")
    public ResponseEntity<?> updateAnalysis(HttpServletRequest req) {
        Long userId = getUserIdFromRequest(req);
        if (userId == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        try {
            User user = userRepo.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            
            UserGamesAnalysisDto analysis = gameAnalysisService.updatePlayerAnalysis(user);
            return ResponseEntity.ok(analysis);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(e.getMessage());
        } catch (Exception e) {
            log.error("Error updating analysis: ", e);
            return ResponseEntity.status(500).body("Error updating analysis");
        }
    }

    /**
     * Get game mode statistics for the user
     * Shows performance metrics for each game mode
     */
    @GetMapping("/game-modes")
    public ResponseEntity<?> getGameModeStatistics(HttpServletRequest req) {
        Long userId = getUserIdFromRequest(req);
        if (userId == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        try {
            User user = userRepo.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            
            // Get all game modes
            var allModes = gameModeService.getAllGameModes();
            var stats = new java.util.ArrayList<GameModeStatisticsDto>();
            
            for (GameMode mode : allModes) {
                GameModeStatisticsDto stat = new GameModeStatisticsDto();
                stat.setModeName(mode.getName());
                stat.setDisplayName(mode.getDisplayName());
                stat.setIcon(mode.getIcon());
                
                // Get games for this mode
                var games = gameRepository.findByUserAndGameMode(user, mode);
                stat.setTotalGames((long) games.size());
                
                if (games.isEmpty()) {
                    stat.setWins(0L);
                    stat.setLosses(0L);
                    stat.setDraws(0L);
                    stat.calculateRates();
                    stat.setAverageAccuracy(0);
                    stat.setTotalTimeSpentMinutes(0L);
                } else {
                    // Calculate statistics
                    long wins = games.stream().filter(g -> "WIN".equals(g.getResult())).count();
                    long losses = games.stream().filter(g -> "LOSS".equals(g.getResult())).count();
                    long draws = games.stream().filter(g -> "DRAW".equals(g.getResult())).count();
                    
                    stat.setWins(wins);
                    stat.setLosses(losses);
                    stat.setDraws(draws);
                    stat.calculateRates();
                    
                    // Calculate average accuracy
                    double avgAccuracy = games.stream()
                        .filter(g -> g.getAccuracyPercentage() != null)
                        .mapToInt(g -> g.getAccuracyPercentage())
                        .average()
                        .orElse(0.0);
                    stat.setAverageAccuracy((int) avgAccuracy);
                    
                    // Calculate total time spent
                    long totalTime = games.stream()
                        .filter(g -> g.getGameDuration() != null)
                        .map(this::parseGameDurationToMinutes)
                        .reduce(0L, Long::sum);
                    stat.setTotalTimeSpentMinutes(totalTime);
                }
                
                stats.add(stat);
            }
            
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            log.error("Error fetching game mode statistics: ", e);
            return ResponseEntity.status(500).body("Error fetching statistics");
        }
    }

        private Long parseGameDurationToMinutes(com.chess4everyone.backend.entity.Game game) {
            if (game.getGameDuration() == null) return 0L;
            try {
                // Format is typically "MM+SS" or just minutes
                String duration = game.getGameDuration();
                String[] parts = duration.split("\\+");
                return Long.parseLong(parts[0]);
            } catch (Exception e) {
                return 0L;
            }
        }
    }