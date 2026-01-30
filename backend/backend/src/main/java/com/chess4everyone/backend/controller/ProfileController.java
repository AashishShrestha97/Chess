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
import com.chess4everyone.backend.dto.MLAnalysisResponse;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.entity.GameMode;
import com.chess4everyone.backend.repo.UserRepository;
import com.chess4everyone.backend.security.JwtService;
import com.chess4everyone.backend.service.GameAnalysisService;
import com.chess4everyone.backend.service.ChessMLAnalysisService;
import com.chess4everyone.backend.service.ChessGameService;
import com.chess4everyone.backend.service.GameModeService;
import com.chess4everyone.backend.repository.GameRepository;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;

@Slf4j
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final UserRepository userRepo;
    private final JwtService jwtService;
    private final GameAnalysisService gameAnalysisService;
    private final ChessMLAnalysisService chessMLAnalysisService;  // NEW: ML microservice
    private final ChessGameService chessGameService;  // NEW: Game fetching service
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
     * Calls Python ML API to analyze 10 most recent games using trained ML models
     * Requires at least 10 games to be played
     * 
     * Architecture: Frontend → Spring Boot → Python ML Server
     */
    @PostMapping("/update-analysis")
    public ResponseEntity<?> updateAnalysis(HttpServletRequest req) {
        Long userId = getUserIdFromRequest(req);
        if (userId == null) {
            log.warn("⚠️ Unauthorized update-analysis request");
            return ResponseEntity.status(401).body("Unauthorized");
        }

        try {
            User user = userRepo.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            
            log.info("📊 Analysis request for user: {} ({})", userId, user.getName());
            
            // Check if user has enough games for analysis
            long gameCount = chessGameService.countGamesWithPGN(user);
            if (gameCount < 10) {
                log.warn("⚠️ User {} has only {} games, need at least 10", userId, gameCount);
                return ResponseEntity.status(400)
                    .body("Need at least 10 games for analysis. You have " + gameCount);
            }
            
            // Call ML microservice to analyze player
            log.info("🔗 Calling ML microservice for analysis...");
            MLAnalysisResponse mlAnalysis = chessMLAnalysisService.analyzePlayer(
                user,
                user.getName(),  // Use user's name as player name
                10  // Analyze 10 most recent games
            );
            
            if (mlAnalysis == null) {
                log.error("❌ ML service returned null response");
                return ResponseEntity.status(500).body("ML analysis returned empty response");
            }
            
            log.info("✅ ML analysis completed successfully");
            log.info("   Games analyzed: {}", mlAnalysis.getGamesAnalyzed());
            log.info("   Strengths: {}", mlAnalysis.getStrengths().size());
            log.info("   Weaknesses: {}", mlAnalysis.getWeaknesses().size());
            
            // TODO: Cache the analysis results in PlayerAnalysis table for future retrieval
            // playerAnalysisRepository.save(playerAnalysis);
            
            // Return the ML analysis response directly to frontend
            return ResponseEntity.ok(mlAnalysis);
            
        } catch (IllegalArgumentException e) {
            log.warn("⚠️ Invalid analysis request: {}", e.getMessage());
            return ResponseEntity.status(400).body(e.getMessage());
        } catch (Exception e) {
            log.error("❌ Error updating analysis: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body("Error updating analysis: " + e.getMessage());
        }
    }

    /**
     * Diagnostic endpoint to check game PGN data
     * /api/profile/debug/games-pgn
     */
    @GetMapping("/debug/games-pgn")
    public ResponseEntity<?> debugGamesPGN(HttpServletRequest req) {
        Long userId = getUserIdFromRequest(req);
        if (userId == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        try {
            User user = userRepo.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            
            var games = chessGameService.getRecentGamesForML(user, 3);
            
            var result = new java.util.HashMap<String, Object>();
            result.put("total_games_in_db", chessGameService.countGamesWithPGN(user));
            result.put("games_returned", games.size());
            
            var gamesList = new java.util.ArrayList<Map<String, Object>>();
            for (int i = 0; i < games.size(); i++) {
                var gameMap = new java.util.HashMap<String, Object>();
                String pgn = games.get(i).getPgn();
                gameMap.put("index", i + 1);
                gameMap.put("pgn_length", pgn != null ? pgn.length() : 0);
                gameMap.put("pgn_first_100_chars", pgn != null && pgn.length() > 100 ? pgn.substring(0, 100) : pgn);
                gameMap.put("pgn_full", pgn);
                gamesList.add(gameMap);
            }
            result.put("games", gamesList);
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("❌ Error getting game PGN: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body("Error: " + e.getMessage());
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