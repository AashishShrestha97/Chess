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
import com.chess4everyone.backend.entity.PlayerAnalysis;
import com.chess4everyone.backend.entity.GameMode;
import com.chess4everyone.backend.repo.UserRepository;
import com.chess4everyone.backend.repository.PlayerAnalysisRepository;
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
    private final ChessMLAnalysisService chessMLAnalysisService;
    private final ChessGameService chessGameService;
    private final GameModeService gameModeService;
    private final GameRepository gameRepository;
    private final PlayerAnalysisRepository playerAnalysisRepository;

    /** Minimum number of complete (ML-worthy) games required for analysis. */
    private static final int MIN_ML_GAMES = 10;

    // ─────────────────────────────────────────────────────────────────────────
    // Auth helper
    // ─────────────────────────────────────────────────────────────────────────

    private Long getUserIdFromRequest(HttpServletRequest req) {
        log.debug("🔍 Extracting user ID from request");

        if (req.getCookies() != null) {
            for (Cookie c : req.getCookies()) {
                if ("ch4e_access".equals(c.getName())) {
                    try {
                        String subject = jwtService.parseToken(c.getValue()).getBody().getSubject();
                        log.debug("✅ Token parsed, user ID: {}", subject);
                        return Long.valueOf(subject);
                    } catch (Exception e) {
                        log.error("❌ Token parsing failed: {}", e.getMessage(), e);
                    }
                }
            }
        } else {
            log.debug("⚠️ No cookies in request");
        }

        log.debug("❌ No valid token found");
        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Profile CRUD
    // ─────────────────────────────────────────────────────────────────────────

    @PutMapping("/update")
    public ResponseEntity<?> updateProfile(HttpServletRequest req,
                                           @RequestBody UpdateProfileRequest updateRequest) {
        try {
            Long userId = getUserIdFromRequest(req);
            if (userId == null) return ResponseEntity.status(401).body("Unauthorized");

            User user = userRepo.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            if (updateRequest.name() != null && !updateRequest.name().trim().isEmpty()) {
                user.setName(updateRequest.name().trim());
            }
            if (updateRequest.phone() != null) {
                user.setPhone(updateRequest.phone().trim().isEmpty() ? null : updateRequest.phone().trim());
            }

            User saved = userRepo.save(user);
            log.info("✅ Profile saved for user: {}", userId);

            return ResponseEntity.ok(new UserResponse(
                    saved.getId(), saved.getName(), saved.getEmail(),
                    saved.getPhone(), saved.getProvider()));
        } catch (Exception e) {
            log.error("❌ Error updating profile: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body("Error updating profile: " + e.getMessage());
        }
    }

    @GetMapping("/user-info")
    public ResponseEntity<?> getUserInfo(HttpServletRequest req) {
        Long userId = getUserIdFromRequest(req);
        if (userId == null) return ResponseEntity.status(401).body("Unauthorized");

        User user = userRepo.findById(userId).orElseThrow();
        return ResponseEntity.ok(new UserResponse(
                user.getId(), user.getName(), user.getEmail(),
                user.getPhone(), user.getProvider()));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Analysis
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/games-analysis")
    public ResponseEntity<?> getGamesAnalysis(HttpServletRequest req) {
        Long userId = getUserIdFromRequest(req);
        if (userId == null) return ResponseEntity.status(401).body("Unauthorized");

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
     * Trigger ML analysis for the current user's recent games.
     *
     * <p>Before calling the Python ML service we check how many <em>complete</em>
     * games the user has (games long enough to yield meaningful features). If
     * the user does not have enough qualifying games we return HTTP 400 with a
     * structured JSON body so the frontend can display a helpful message.</p>
     */
    @PostMapping("/update-analysis")
    public ResponseEntity<?> updateAnalysis(HttpServletRequest req,
                                            @RequestBody(required = false) Map<String, Object> body) {
        Long userId = getUserIdFromRequest(req);
        if (userId == null) {
            log.warn("⚠️ Unauthorized update-analysis request");
            return ResponseEntity.status(401).body("Unauthorized");
        }

        try {
            User user = userRepo.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            log.info("📊 Analysis request for user: {} ({})", userId, user.getName());

            // ── Determine requested game count (default = MIN_ML_GAMES) ───────
            int requestedCount = MIN_ML_GAMES;
            if (body != null && body.get("count") != null) {
                try {
                    requestedCount = Integer.parseInt(String.valueOf(body.get("count")));
                } catch (NumberFormatException nfe) {
                    log.warn("⚠️ Invalid count in request body: {}", body.get("count"));
                }
            }
            // Cap within [MIN_ML_GAMES, 20]
            requestedCount = Math.max(MIN_ML_GAMES, Math.min(20, requestedCount));

            // ── Check quality game count BEFORE calling ML service ────────────
            long mlWorthyCount = chessGameService.countMLWorthyGames(user);
            long totalGames    = chessGameService.countGamesWithPGN(user);

            if (mlWorthyCount < requestedCount) {
                long gamesNeeded = requestedCount - mlWorthyCount;

                log.warn("⚠️ User {} has only {} complete games (need {}); {} games filtered as too short",
                        userId, mlWorthyCount, requestedCount, totalGames - mlWorthyCount);

                // Return a structured 400 the frontend can parse
                return ResponseEntity.status(400).body(Map.of(
                        "error",           "NOT_ENOUGH_COMPLETE_GAMES",
                        "message",         buildNotEnoughGamesMessage(mlWorthyCount, gamesNeeded, totalGames),
                        "mlWorthyGames",   mlWorthyCount,
                        "totalGames",      totalGames,
                        "gamesNeeded",     gamesNeeded,
                        "minimumRequired", requestedCount
                ));
            }

            // ── Call ML microservice ───────────────────────────────────────────
            log.info("🔗 Calling ML microservice (games={})...", requestedCount);
            MLAnalysisResponse mlAnalysis = chessMLAnalysisService.analyzePlayer(
                    user, user.getName(), requestedCount);

            if (mlAnalysis == null) {
                log.error("❌ ML service returned null response");
                return ResponseEntity.status(500).body("ML analysis returned empty response");
            }

            log.info("✅ ML analysis completed — games={}, strengths={}, weaknesses={}",
                    mlAnalysis.getGamesAnalyzed(),
                    mlAnalysis.getStrengths().size(),
                    mlAnalysis.getWeaknesses().size());

            // ── Persist analysis results ──────────────────────────────────────
            try {
                PlayerAnalysis playerAnalysis = playerAnalysisRepository.findByUser(user)
                        .orElseGet(() -> {
                            PlayerAnalysis a = new PlayerAnalysis();
                            a.setUser(user);
                            return a;
                        });

                com.fasterxml.jackson.databind.ObjectMapper mapper =
                        new com.fasterxml.jackson.databind.ObjectMapper();

                playerAnalysis.setGamesAnalyzed(mlAnalysis.getGamesAnalyzed());
                playerAnalysis.setStrengths(mapper.writeValueAsString(mlAnalysis.getStrengths()));
                playerAnalysis.setWeaknesses(mapper.writeValueAsString(mlAnalysis.getWeaknesses()));

                java.util.Map<String, Object> predictions = new java.util.HashMap<>();
                if (mlAnalysis.getPredictions() != null) {
                    java.util.Map<String, Object> mlPredictions = mapper.convertValue(
                            mlAnalysis.getPredictions(),
                            new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, Object>>() {});
                    predictions.put("opening",        mlPredictions.get("opening"));
                    predictions.put("middlegame",      mlPredictions.get("middlegame"));
                    predictions.put("endgame",         mlPredictions.get("endgame"));
                    predictions.put("tactical",        mlPredictions.get("tactical"));
                    predictions.put("positional",      mlPredictions.getOrDefault("positional", mlPredictions.get("strategy")));
                    predictions.put("timeManagement",  mlPredictions.getOrDefault("timeManagement", mlPredictions.get("time_management")));
                }
                playerAnalysis.setPredictions(mapper.writeValueAsString(predictions));
                playerAnalysis.setMetrics(mapper.writeValueAsString(mlAnalysis.getFeatures()));

                playerAnalysisRepository.save(playerAnalysis);
                log.info("✅ Analysis persisted for user: {}", userId);
            } catch (Exception e) {
                log.error("⚠️ Failed to persist analysis (non-fatal): {}", e.getMessage());
            }

            return ResponseEntity.ok(mlAnalysis);

        } catch (IllegalArgumentException e) {
            log.warn("⚠️ Invalid analysis request: {}", e.getMessage());
            return ResponseEntity.status(400).body(Map.of(
                    "error",   "INVALID_REQUEST",
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("❌ Error updating analysis: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(
                    "error",   "ANALYSIS_FAILED",
                    "message", "Error updating analysis: " + e.getMessage()
            ));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Debug / diagnostic
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/debug/games-pgn")
    public ResponseEntity<?> debugGamesPGN(HttpServletRequest req) {
        Long userId = getUserIdFromRequest(req);
        if (userId == null) return ResponseEntity.status(401).body("Unauthorized");

        try {
            User user = userRepo.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            var games  = chessGameService.getRecentGamesForML(user, 3);
            var result = new java.util.HashMap<String, Object>();
            result.put("total_games_in_db",    chessGameService.countGamesWithPGN(user));
            result.put("ml_worthy_games",      chessGameService.countMLWorthyGames(user));
            result.put("games_returned",        games.size());

            var gamesList = new java.util.ArrayList<Map<String, Object>>();
            for (int i = 0; i < games.size(); i++) {
                var gameMap = new java.util.HashMap<String, Object>();
                String pgn = games.get(i).getPgn();
                gameMap.put("index",            i + 1);
                gameMap.put("pgn_length",        pgn != null ? pgn.length() : 0);
                gameMap.put("pgn_first_100_chars", pgn != null && pgn.length() > 100 ? pgn.substring(0, 100) : pgn);
                gamesList.add(gameMap);
            }
            result.put("games", gamesList);

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("❌ Error getting game PGN: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body("Error: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Game mode statistics
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/game-modes")
    public ResponseEntity<?> getGameModeStatistics(HttpServletRequest req) {
        Long userId = getUserIdFromRequest(req);
        if (userId == null) return ResponseEntity.status(401).body("Unauthorized");

        try {
            User user = userRepo.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            var allModes = gameModeService.getAllGameModes();
            var stats    = new java.util.ArrayList<GameModeStatisticsDto>();

            for (GameMode mode : allModes) {
                GameModeStatisticsDto stat = new GameModeStatisticsDto();
                stat.setModeName(mode.getName());
                stat.setDisplayName(mode.getDisplayName());
                stat.setIcon(mode.getIcon());

                var games = gameRepository.findByUserAndGameMode(user, mode);
                stat.setTotalGames((long) games.size());

                if (games.isEmpty()) {
                    stat.setWins(0L); stat.setLosses(0L); stat.setDraws(0L);
                    stat.calculateRates(); stat.setAverageAccuracy(0); stat.setTotalTimeSpentMinutes(0L);
                } else {
                    long wins   = games.stream().filter(g -> "WIN".equals(g.getResult())).count();
                    long losses = games.stream().filter(g -> "LOSS".equals(g.getResult())).count();
                    long draws  = games.stream().filter(g -> "DRAW".equals(g.getResult())).count();
                    stat.setWins(wins); stat.setLosses(losses); stat.setDraws(draws);
                    stat.calculateRates();

                    double avgAcc = games.stream()
                            .filter(g -> g.getAccuracyPercentage() != null)
                            .mapToInt(g -> g.getAccuracyPercentage())
                            .average().orElse(0.0);
                    stat.setAverageAccuracy((int) avgAcc);

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

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private String buildNotEnoughGamesMessage(long available, long needed, long totalIncludingShort) {
        long shortGames = totalIncludingShort - available;
        StringBuilder sb = new StringBuilder();
        sb.append("You need ").append(needed).append(" more complete game")
          .append(needed == 1 ? "" : "s").append(" for AI analysis. ");
        sb.append("You currently have ").append(available).append(" qualifying game")
          .append(available == 1 ? "" : "s").append(".");
        if (shortGames > 0) {
            sb.append(" (").append(shortGames).append(" game")
              .append(shortGames == 1 ? " was" : "s were")
              .append(" too short — games must have at least 10 moves to count.)");
        }
        return sb.toString();
    }

    private Long parseGameDurationToMinutes(com.chess4everyone.backend.entity.Game game) {
        if (game.getGameDuration() == null) return 0L;
        try {
            String[] parts = game.getGameDuration().split("\\+");
            return Long.parseLong(parts[0]);
        } catch (Exception e) {
            return 0L;
        }
    }
}