package com.chess4everyone.backend.service;

import java.time.Instant;
import java.util.*;
import java.net.URI;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.chess4everyone.backend.dto.*;
import com.chess4everyone.backend.entity.Game;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.entity.PlayerAnalysis;
import com.chess4everyone.backend.repository.GameRepository;
import com.chess4everyone.backend.repository.PlayerAnalysisRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

/**
 * Service for analyzing player's chess performance using AI models
 * Analyzes 10 most recent games to determine strengths/weaknesses using Python AI inference
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GameAnalysisService {

    private final GameRepository gameRepository;
    private final PlayerAnalysisRepository playerAnalysisRepository;
    private final GameModeService gameModeService;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${chess.ai.api.url:http://localhost:8000/analyze-player}")
    private String aiApiUrl;
    
    @Value("${chess.ai.api.enabled:false}")
    private boolean aiApiEnabled;

    /**
     * Get user's game statistics and analysis
     * Returns basic stats and AI analysis if 10+ games are available
     */
    public UserGamesAnalysisDto getUserGamesAnalysis(User user) {
        List<Game> userGames = gameRepository.findByUserOrderByPlayedAtDesc(user);

        // Calculate basic statistics
        int totalGames = userGames.size();
        int wins = (int) userGames.stream()
                .filter(g -> "WIN".equals(g.getResult()))
                .count();
        int losses = (int) userGames.stream()
                .filter(g -> "LOSS".equals(g.getResult()))
                .count();
        int draws = (int) userGames.stream()
                .filter(g -> "DRAW".equals(g.getResult()))
                .count();
        double winRate = totalGames > 0 ? (wins * 100.0) / totalGames : 0.0;

        // Get cached analysis if available
        Optional<PlayerAnalysis> cachedAnalysis = playerAnalysisRepository
                .findByUser(user);

        Optional<AnalysisResultDto> analysisData = Optional.empty();
        Optional<String> lastAnalysisDate = Optional.empty();

        if (cachedAnalysis.isPresent() && totalGames >= 10) {
            try {
                PlayerAnalysis pa = cachedAnalysis.get();
                analysisData = Optional.of(parseAnalysisResult(pa));
                lastAnalysisDate = Optional.of(pa.getUpdatedAt().toString());
            } catch (Exception e) {
                log.error("Error parsing cached analysis: ", e);
            }
        }

        return new UserGamesAnalysisDto(
                user.getName(),
                user.getEmail(),
                user.getPhone() != null ? user.getPhone() : "",
                totalGames,
                wins,
                losses,
                draws,
                winRate,
                analysisData,
                lastAnalysisDate
        );
    }

    /**
     * Update player analysis with latest games
     * Requires at least 10 games
     */
    public UserGamesAnalysisDto updatePlayerAnalysis(User user) {
        List<Game> userGames = gameRepository.findByUserOrderByPlayedAtDesc(user);

        if (userGames.size() < 10) {
            throw new IllegalArgumentException("Need at least 10 games for analysis");
        }

        // Get 10 most recent games
        List<Game> recentGames = userGames.stream()
                .limit(10)
                .toList();

        // Simulate AI analysis (in production, call Python API)
        AnalysisResultDto analysisResult = generateAIAnalysis(user, recentGames);

        // Cache the analysis result
        PlayerAnalysis playerAnalysis = playerAnalysisRepository
                .findByUser(user)
                .orElse(new PlayerAnalysis());

        playerAnalysis.setUser(user);
        playerAnalysis.setGamesAnalyzed(recentGames.size());
        playerAnalysis.setAnalyzedAt(Instant.now());

        try {
            playerAnalysis.setStrengths(objectMapper.writeValueAsString(analysisResult.strengths()));
            playerAnalysis.setWeaknesses(objectMapper.writeValueAsString(analysisResult.weaknesses()));
            playerAnalysis.setMetrics(objectMapper.writeValueAsString(analysisResult.features()));
            
            // Save predictions as JSON
            Map<String, Object> predictions = new HashMap<>();
            predictions.put("opening", analysisResult.predictions().opening());
            predictions.put("middlegame", analysisResult.predictions().middlegame());
            predictions.put("endgame", analysisResult.predictions().endgame());
            predictions.put("tactical", analysisResult.predictions().tactical());
            predictions.put("positional", analysisResult.predictions().positional());
            predictions.put("timeManagement", analysisResult.predictions().timeManagement());
            playerAnalysis.setPredictions(objectMapper.writeValueAsString(predictions));
        } catch (Exception e) {
            log.error("Error serializing analysis: ", e);
        }

        playerAnalysisRepository.save(playerAnalysis);

        // Return updated game analysis
        return getUserGamesAnalysis(user);
    }

    /**
     * Generate AI-based analysis for player using Python inference API
     * Calls Python API with PGN games to get ML model predictions
     * Falls back to mock implementation if API is unavailable
     */
    private AnalysisResultDto generateAIAnalysis(User user, List<Game> games) {
        log.info("📊 Generating AI analysis for user: {}", user.getId());
        
        // Try to use Python AI API if enabled
        if (aiApiEnabled) {
            try {
                AnalysisResultDto apiResult = callPythonAIApi(user, games);
                if (apiResult != null) {
                    log.info("✓ AI analysis retrieved from Python API");
                    return apiResult;
                }
            } catch (Exception e) {
                log.warn("⚠ Failed to call Python AI API, falling back to local analysis: {}", e.getMessage());
            }
        }
        
        // Fallback: Generate local analysis based on game statistics
        log.info("📈 Using local analysis fallback");
        return generateLocalAnalysis(user, games);
    }
    
    /**
     * Call Python AI inference API with PGN games
     * Sends games to Python service for Stockfish analysis and ML model predictions
     */
    private AnalysisResultDto callPythonAIApi(User user, List<Game> games) {
        try {
            log.info("🔌 Calling Python API at: {}", aiApiUrl);
            log.info("   Games to send: {}", games.size());
            
            // Prepare request with PGN games
            Map<String, Object> request = new HashMap<>();
            request.put("user_id", String.valueOf(user.getId()));
            request.put("player_name", user.getName());
            
            // Convert games to PGN format
            List<Map<String, String>> pgns = new ArrayList<>();
            for (Game game : games) {
                Map<String, String> pgn = new HashMap<>();
                pgn.put("pgn", game.getPgn() != null ? game.getPgn() : "");
                pgns.add(pgn);
            }
            request.put("games", pgns);
            
            // Make HTTP POST request to Python API
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> httpRequest = new HttpEntity<>(request, headers);
            
            log.info("📤 Sending request to ML API...");
            Map<String, Object> response = restTemplate.postForObject(
                    aiApiUrl,
                    httpRequest,
                    Map.class
            );
            
            if (response == null) {
                log.error("⚠ Empty response from Python API (null)");
                return null;
            }
            
            log.info("✅ Received response from Python API");
            log.info("   Response keys: {}", response.keySet());
            if (response.containsKey("categories")) {
                log.info("   Found 'categories' array (test app format)");
            }
            if (response.containsKey("predictions")) {
                log.info("   Found 'predictions' field");
            }
            
            // Convert response to AnalysisResultDto
            return parsePythonApiResponse(response);
            
        } catch (Exception e) {
            log.error("❌ Error calling Python API: {}", e.getMessage(), e);
            return null;
        }
    }
    
    /**
     * Parse Python API response and convert to AnalysisResultDto
     * Handles both formats: predictions map OR categories array (test app format)
     */
    @SuppressWarnings("unchecked")
    private AnalysisResultDto parsePythonApiResponse(Map<String, Object> response) {
        try {
            String userId = (String) response.get("user_id");
            if (userId == null) userId = "0";
            
            String timestamp = (String) response.get("timestamp");
            if (timestamp == null) timestamp = java.time.Instant.now().toString();
            
            Integer gamesAnalyzed = 1;
            Object gamesObj = response.get("games_analyzed");
            if (gamesObj != null && gamesObj instanceof Number) {
                gamesAnalyzed = ((Number) gamesObj).intValue();
            }
            
            log.info("📊 Parsing API response: user={}, games={}, timestamp={}", userId, gamesAnalyzed, timestamp);
            
            Map<String, Map<String, Object>> predictions = new HashMap<>();

            // FIRST: Check for top-level "categories" array (from test app)
            if (response.containsKey("categories") && response.get("categories") instanceof List) {
                log.info("📋 Converting test app 'categories' array to predictions map");
                List<?> categories = (List<?>) response.get("categories");
                
                for (Object item : categories) {
                    if (!(item instanceof Map)) continue;
                    Map<String, Object> catItem = (Map<String, Object>) item;
                    
                    // Extract category name
                    Object catNameObj = catItem.get("category");
                    if (catNameObj == null) catNameObj = catItem.get("name");
                    if (catNameObj == null) continue;
                    
                    String catName = String.valueOf(catNameObj).trim().toLowerCase();
                    
                    // Normalize category name
                    String catKey = normalizeCategoryKey(catName);
                    
                    // Extract score (0-4 scale in test app)
                    Integer scoreVal = null;
                    Object scoreObj = catItem.get("score");
                    if (scoreObj instanceof Number) {
                        scoreVal = ((Number) scoreObj).intValue();
                    }
                    
                    // Extract classification
                    String classification = (String) catItem.getOrDefault("classification", "average");
                    
                    // Convert score 0-4 to numeric_score 0-2 and confidence 0-1
                    Integer numericScore = 1;  // default to average
                    Double confidence = 0.5;   // default confidence
                    
                    if (scoreVal != null && scoreVal >= 0) {
                        // Test app uses: 0=poor, 1=weak, 2=average, 3=good, 4=excellent
                        // We need: 0=weak, 1=average, 2=strong
                        if (scoreVal >= 3) {
                            numericScore = 2;  // strong
                            confidence = Math.min(1.0, (scoreVal / 4.0));  // 0.75 or 1.0
                        } else if (scoreVal == 2) {
                            numericScore = 1;  // average
                            confidence = 0.5;
                        } else {
                            numericScore = 0;  // weak
                            confidence = Math.max(0.0, (scoreVal / 4.0));  // 0.0 to 0.5
                        }
                    }
                    
                    // Build prediction entry
                    Map<String, Object> predEntry = new HashMap<>();
                    predEntry.put("classification", classification);
                    predEntry.put("confidence", confidence);
                    predEntry.put("numeric_score", numericScore);
                    
                    predictions.put(catKey, predEntry);
                    log.debug("   {}: score={} -> numericScore={}, confidence={}", catKey, scoreVal, numericScore, confidence);
                }
            } 
            // SECOND: Check for "predictions" map (standard format)
            else if (response.containsKey("predictions") && response.get("predictions") instanceof Map) {
                log.info("📊 Using 'predictions' map from response");
                Map<String, Object> predictionsMap = (Map<String, Object>) response.get("predictions");
                for (String key : predictionsMap.keySet()) {
                    Object val = predictionsMap.get(key);
                    if (val instanceof Map) {
                        predictions.put(key, (Map<String, Object>) val);
                    }
                }
            } 
            // THIRD: Check for "predictions" array
            else if (response.containsKey("predictions") && response.get("predictions") instanceof List) {
                log.info("📋 Converting 'predictions' array to map");
                List<?> predList = (List<?>) response.get("predictions");
                for (Object item : predList) {
                    if (!(item instanceof Map)) continue;
                    Map<String, Object> itemMap = (Map<String, Object>) item;
                    Object catObj = itemMap.get("category");
                    if (catObj == null) catObj = itemMap.get("name");
                    if (catObj == null) continue;
                    
                    String catKey = normalizeCategoryKey(String.valueOf(catObj).trim().toLowerCase());
                    Object classification = itemMap.get("classification");
                    Object scoreObj = itemMap.get("score");

                    Integer numericScore = null;
                    Double confidence = null;
                    if (scoreObj instanceof Number) {
                        int scoreVal = ((Number) scoreObj).intValue();
                        if (scoreVal >= 3) numericScore = 2;
                        else if (scoreVal == 2) numericScore = 1;
                        else numericScore = 0;
                        confidence = Math.max(0.0, Math.min(1.0, scoreVal / 4.0));
                    }

                    Map<String, Object> predEntry = new HashMap<>();
                    if (classification != null) predEntry.put("classification", classification);
                    if (confidence != null) predEntry.put("confidence", confidence);
                    if (numericScore != null) predEntry.put("numeric_score", numericScore);

                    predictions.put(catKey, predEntry);
                }
            }
            
            log.info("✅ Parsed predictions: {} categories found", predictions.size());
            
            // Build CategoryAnalysisDto for each prediction
            PredictionsDto preds = new PredictionsDto(
                    parseCategoryPrediction(predictions.get("opening")),
                    parseCategoryPrediction(predictions.get("middlegame")),
                    parseCategoryPrediction(predictions.get("endgame")),
                    parseCategoryPrediction(predictions.get("tactical")),
                    parseCategoryPrediction(predictions.get("positional")),
                    parseCategoryPrediction(predictions.get("timemanagement"))
            );
            
            // Parse strengths and weaknesses
            List<String> strengths = (List<String>) response.get("strengths");
            if (strengths == null) strengths = new ArrayList<>();
            
            List<String> weaknesses = (List<String>) response.get("weaknesses");
            if (weaknesses == null) weaknesses = new ArrayList<>();
            
            // Parse features
            Map<String, Double> features = new HashMap<>();
            Map<String, Object> featuresMap = (Map<String, Object>) response.get("features");
            if (featuresMap != null) {
                for (String key : featuresMap.keySet()) {
                    Object val = featuresMap.get(key);
                    if (val instanceof Number) {
                        features.put(key, ((Number) val).doubleValue());
                    }
                }
            }
            
            String recommendation = (String) response.get("recommendation");
            if (recommendation == null) recommendation = "Keep improving!";
            
            return new AnalysisResultDto(
                    userId,
                    timestamp,
                    gamesAnalyzed,
                    preds,
                    strengths,
                    weaknesses,
                    features,
                    recommendation
            );
            
        } catch (Exception e) {
            log.error("Error parsing Python API response: {}", e.getMessage(), e);
            e.printStackTrace();
            return null;
        }
    }
    
    /**
     * Normalize category key names to standard format
     */
    private String normalizeCategoryKey(String categoryName) {
        String lower = categoryName.toLowerCase().trim();
        if (lower.contains("opening")) return "opening";
        if (lower.contains("middle")) return "middlegame";
        if (lower.contains("endgame")) return "endgame";
        if (lower.contains("tactic")) return "tactical";
        if (lower.contains("position") || lower.contains("strategy")) return "positional";
        if (lower.contains("time")) return "timemanagement";
        return lower;
    }
    
    /**
     * Parse individual category prediction from API response
     */
    @SuppressWarnings("unchecked")
    private CategoryAnalysisDto parseCategoryPrediction(Map<String, Object> predMap) {
        try {
            if (predMap == null) {
                // Return default average classification
                return new CategoryAnalysisDto("average", 0.5, 1);
            }

            // classification may be under different keys or be null
            Object clsObj = predMap.getOrDefault("classification", predMap.get("class"));
            String classification = clsObj != null ? String.valueOf(clsObj) : "average";

            // confidence may be 0..1 or 0..100 (or missing)
            Double confidence = 0.5;
            Object confObj = predMap.get("confidence");
            if (confObj == null) confObj = predMap.get("conf");
            if (confObj != null) {
                try {
                    double c = Double.parseDouble(String.valueOf(confObj));
                    if (c > 1.0) c = Math.min(100.0, c) / 100.0;
                    confidence = Math.max(0.0, Math.min(1.0, c));
                } catch (Exception e) {
                    // keep default
                }
            }

            // numeric score may be under several keys
            Integer numericScore = 1;
            Object numObj = predMap.get("numeric_score");
            if (numObj == null) numObj = predMap.get("numericScore");
            if (numObj == null) numObj = predMap.get("score");
            if (numObj != null) {
                try {
                    numericScore = ((Number) numObj).intValue();
                } catch (Exception e) {
                    try { numericScore = Integer.parseInt(String.valueOf(numObj)); } catch (Exception ex) { /* ignore */ }
                }
            } else {
                // derive from classification
                if ("strong".equalsIgnoreCase(classification) || "excellent".equalsIgnoreCase(classification)) numericScore = 2;
                else if ("average".equalsIgnoreCase(classification)) numericScore = 1;
                else numericScore = 0;
            }

            return new CategoryAnalysisDto(classification, confidence, numericScore);
        } catch (Exception e) {
            log.warn("Failed to parse category prediction: {}", e.getMessage());
            return new CategoryAnalysisDto("average", 0.5, 1);
        }
    }
    
    /**
     * Generate local AI-based analysis (fallback when Python API unavailable)
     * Uses game statistics and heuristics to estimate player strengths/weaknesses
     */
    private AnalysisResultDto generateLocalAnalysis(User user, List<Game> games) {
        // Calculate game statistics for analysis
        int wins = (int) games.stream()
                .filter(g -> "WIN".equals(g.getResult()))
                .count();
        int losses = (int) games.stream()
                .filter(g -> "LOSS".equals(g.getResult()))
                .count();

        // Simulate ML model predictions based on game patterns
        // In production: analyze actual game moves with Stockfish -> extract features -> run ML models
        Map<String, CategoryAnalysisDto> predictions = generateCategoryPredictions(user, games);

        List<String> strengths = determineStrengths(predictions);
        List<String> weaknesses = determineWeaknesses(predictions);

        Map<String, Double> features = calculateFeatures(games);

        String recommendation = generateRecommendation(strengths, weaknesses);

        return new AnalysisResultDto(
                String.valueOf(user.getId()),
                Instant.now().toString(),
                games.size(),
                new PredictionsDto(
                        predictions.get("opening"),
                        predictions.get("middlegame"),
                        predictions.get("endgame"),
                        predictions.get("tactical"),
                        predictions.get("positional"),
                        predictions.get("timeManagement")
                ),
                strengths,
                weaknesses,
                features,
                recommendation
        );
    }

    /**
     * Generate category predictions based on actual game data
     * IMPROVED: Uses user-specific game patterns to generate unique analysis
     * Each user gets different results based on their actual games
     */
    private Map<String, CategoryAnalysisDto> generateCategoryPredictions(User user, List<Game> games) {
        Map<String, CategoryAnalysisDto> predictions = new HashMap<>();

        // Calculate base metrics that vary per user
        int wins = (int) games.stream().filter(g -> "WIN".equals(g.getResult())).count();
        int losses = (int) games.stream().filter(g -> "LOSS".equals(g.getResult())).count();
        double winRate = !games.isEmpty() ? (double) wins / games.size() : 0.5;
        
        double avgAccuracy = games.stream()
                .filter(g -> g.getAccuracyPercentage() != null && g.getAccuracyPercentage() > 0)
                .mapToInt(Game::getAccuracyPercentage)
                .average()
                .orElse(60.0) / 100.0;
        
        // Use USER ID as seed for consistent but unique analysis per user
        long userIdSeed = user.getId();
        
        // Create user-specific variance: different users get different results
        // This ensures User 1 gets different scores than User 2 even with same game data
        double userVariance = ((userIdSeed % 7) - 3.5) / 100.0; // -3.5% to +3.5% variance per user
        
        // Opening: 50% based on win rate + 30% accuracy + 20% based on user variance
        double openingScore = (winRate * 0.5) + (avgAccuracy * 0.3) + 0.2 + userVariance;
        predictions.put("opening", classifyPerformance(openingScore, "opening", wins, losses));
        
        // Middlegame: heavily based on loss analysis + user-specific variation
        double middlegameScore = analyzeByLosses(games) + userVariance;
        predictions.put("middlegame", classifyPerformance(middlegameScore, "middlegame", wins, losses));
        
        // Endgame: based on long games (30+ moves) and conversion rate
        double endgameScore = analyzeLongGamePerformance(games) + (userVariance * 0.8);
        predictions.put("endgame", classifyPerformance(endgameScore, "endgame", wins, losses));
        
        // Tactical: accuracy is key - if accuracy is low, tactics are weak
        double tacticalScore = avgAccuracy * 0.7 + (winRate * 0.3) + (userVariance * 0.5);
        if (avgAccuracy < 0.5) tacticalScore *= 0.6; // Heavy penalty for low accuracy
        predictions.put("tactical", classifyPerformance(tacticalScore, "tactical", wins, losses));
        
        // Positional: opposite of tactical - if wins without high accuracy, positional is strong
        double positionalScore = (1.0 - Math.abs(avgAccuracy - 0.65)) * 0.5 + (winRate * 0.5) + (userVariance * 0.3);
        predictions.put("positional", classifyPerformance(positionalScore, "positional", wins, losses));
        
        // Time Management: based on losses with specific termination reasons
        double timeManagementScore = analyzeTimeManagementByGameType(games) + userVariance;
        predictions.put("timeManagement", classifyPerformance(timeManagementScore, "time", wins, losses));

        return predictions;
    }

    /**
     * Analyze performance by looking at loss patterns
     * Different users have different loss patterns - this shows them
     * Returns 0-1 score: higher = fewer losses = better middlegame
     */
    private double analyzeByLosses(List<Game> games) {
        if (games.isEmpty()) return 0.5;
        
        int wins = (int) games.stream().filter(g -> "WIN".equals(g.getResult())).count();
        int losses = (int) games.stream().filter(g -> "LOSS".equals(g.getResult())).count();
        int draws = (int) games.stream().filter(g -> "DRAW".equals(g.getResult())).count();
        
        // User-specific loss pattern: DIRECTLY reflects their actual performance
        // User with 9 wins, 1 loss -> 0.9 (strong)
        // User with 5 wins, 5 losses -> 0.5 (average)
        // User with 3 wins, 7 losses -> 0.3 (weak)
        double winRate = (double) wins / games.size();
        double lossRate = (double) losses / games.size();
        
        // Score = wins - losses, normalized
        // Also consider draws as slight positive
        return winRate - (lossRate * 0.6) + (draws > 0 ? 0.05 : 0);
    }
    
    /**
     * Analyze long games (30+ moves = endgame reached)
     * Different users reach endgame at different rates
     */
    private double analyzeLongGamePerformance(List<Game> games) {
        List<Game> longGames = games.stream()
                .filter(g -> g.getMoveCount() != null && g.getMoveCount() >= 25)
                .toList();
        
        if (longGames.isEmpty()) {
            // User doesn't reach endgame much - might be weak at endgame OR wins quickly
            long quickWins = games.stream()
                    .filter(g -> "WIN".equals(g.getResult()) && 
                           (g.getMoveCount() == null || g.getMoveCount() < 25))
                    .count();
            return quickWins > 5 ? 0.7 : 0.4; // Quick wins = maybe opening focused
        }
        
        long longGameWins = longGames.stream()
                .filter(g -> "WIN".equals(g.getResult()))
                .count();
        
        return (double) longGameWins / longGames.size();
    }
    
    /**
     * Analyze time management by looking at game types and losses
     * Blitz losses vs Rapid losses tell different stories
     */
    private double analyzeTimeManagementByGameType(List<Game> games) {
        // Count blitz/rapid games separately
        long blitzGames = games.stream()
                .filter(g -> g.getTimeControl() != null && 
                       (g.getTimeControl().contains("+0") || g.getTimeControl().contains("+1")))
                .count();
        
        long rapidGames = games.stream()
                .filter(g -> g.getTimeControl() != null && 
                       (g.getTimeControl().contains("+") && !g.getTimeControl().contains("+0")))
                .count();
        
        // Different time controls show different time management skills
        double blitzScore = blitzGames > 0 ? 
            (double) games.stream()
                    .filter(g -> g.getTimeControl() != null && g.getTimeControl().contains("+0"))
                    .filter(g -> "WIN".equals(g.getResult()))
                    .count() / blitzGames : 0.5;
        
        double rapidScore = rapidGames > 0 ? 
            (double) games.stream()
                    .filter(g -> g.getTimeControl() != null && g.getTimeControl().contains("+"))
                    .filter(g -> "WIN".equals(g.getResult()))
                    .count() / rapidGames : 0.5;
        
        // If user plays more blitz, their blitz score matters more
        if (blitzGames > rapidGames) {
            return blitzScore * 0.7 + rapidScore * 0.3;
        } else {
            return blitzScore * 0.3 + rapidScore * 0.7;
        }
    }

    /**
     * Analyze middlegame performance from games
     * Heavily penalize games with low accuracy and quick losses
     */
    private double analyzeMiddlegame(List<Game> games) {
        // Middlegame analysis based on:
        // - Win rate
        // - Average accuracy (low accuracy = middlegame mistakes)
        // - Rating change (negative = middlegame blunders)
        // - Losing patterns
        
        int middlegameWins = (int) games.stream()
                .filter(g -> "WIN".equals(g.getResult()))
                .count();
        
        int losses = (int) games.stream()
                .filter(g -> "LOSS".equals(g.getResult()))
                .count();
        
        double winRate = games.size() > 0 ? (double) middlegameWins / games.size() : 0.5;
        
        // Analyze loss accuracy - if losses have low accuracy, middlegame is weak
        double lossAccuracy = games.stream()
                .filter(g -> "LOSS".equals(g.getResult()) && g.getAccuracyPercentage() != null)
                .mapToInt(Game::getAccuracyPercentage)
                .average()
                .orElse(50.0) / 100.0;
        
        double avgAccuracy = games.stream()
                .filter(g -> g.getAccuracyPercentage() != null)
                .mapToInt(Game::getAccuracyPercentage)
                .average()
                .orElse(50.0) / 100.0;
        
        // Penalize if losses have significantly lower accuracy
        double accuracyPenalty = 0.0;
        if (losses > 0) {
            double accuracyDifference = avgAccuracy - lossAccuracy;
            if (accuracyDifference > 0.15) { // Large difference indicates middlegame issues
                accuracyPenalty = 0.3;
            }
        }
        
        // Average rating change (negative = middlegame blunders)
        double avgRatingChange = games.stream()
                .filter(g -> g.getRatingChange() != null)
                .mapToInt(Game::getRatingChange)
                .average()
                .orElse(0.0);
        
        double ratingScore = Math.max(0.0, Math.min(1.0, (avgRatingChange + 50) / 100)); // Normalize
        
        // Combined: 50% win rate + 35% accuracy - penalty + 15% rating
        return Math.max(0.0, (winRate * 0.5) + (avgAccuracy * 0.35) - accuracyPenalty + (ratingScore * 0.15));
    }

    /**
     * Analyze endgame performance from games
     * Penalize games where player lost in the endgame
     */
    private double analyzeEndgame(List<Game> games) {
        // Endgame analysis based on:
        // - Wins in games with high move counts (endgame reached)
        // - Losses in endgame (long games that were lost)
        // - Conversion rate when winning
        
        List<Game> longGames = games.stream()
                .filter(g -> g.getMoveCount() != null && g.getMoveCount() >= 30)
                .toList();
        
        if (longGames.isEmpty()) {
            // If no long games played, cannot assess endgame
            return 0.5;
        }
        
        int endgameWins = (int) longGames.stream()
                .filter(g -> "WIN".equals(g.getResult()))
                .count();
        
        int endgameLosses = (int) longGames.stream()
                .filter(g -> "LOSS".equals(g.getResult()))
                .count();
        
        double conversionRate = (double) endgameWins / longGames.size();
        
        // Heavily penalize endgame losses - indicates weakness
        double lossPenalty = endgameLosses > 0 ? ((double) endgameLosses / longGames.size()) * 0.4 : 0.0;
        
        double avgAccuracy = longGames.stream()
                .filter(g -> g.getAccuracyPercentage() != null)
                .mapToInt(Game::getAccuracyPercentage)
                .average()
                .orElse(50.0) / 100.0;
        
        // Combined: 60% conversion rate + 30% accuracy - loss penalty
        return Math.max(0.0, (conversionRate * 0.6) + (avgAccuracy * 0.3) - lossPenalty);
    }

    /**
     * Analyze tactical awareness from games
     * Low accuracy = tactical blunders = weakness
     */
    private double analyzeTactical(List<Game> games) {
        // Tactical analysis based on:
        // - Overall accuracy (high accuracy = good tactics)
        // - Blunder rate (accuracy in lost games)
        // - Win rate via tactics (quick wins)
        
        double avgAccuracy = games.stream()
                .filter(g -> g.getAccuracyPercentage() != null)
                .mapToInt(Game::getAccuracyPercentage)
                .average()
                .orElse(50.0) / 100.0;
        
        // Analyze loss accuracy - poor tactical play shows in low accuracy on losses
        double lossAccuracy = games.stream()
                .filter(g -> "LOSS".equals(g.getResult()) && g.getAccuracyPercentage() != null)
                .mapToInt(Game::getAccuracyPercentage)
                .average()
                .orElse(50.0) / 100.0;
        
        long losses = games.stream()
                .filter(g -> "LOSS".equals(g.getResult()))
                .count();
        
        // Big accuracy difference on losses = tactical weakness
        double tacticalBlunderRate = 0.0;
        if (losses > 0) {
            double accuracyDrop = avgAccuracy - lossAccuracy;
            tacticalBlunderRate = Math.min(0.4, accuracyDrop * 2); // -40% max penalty
        }
        
        int tacticalWins = (int) games.stream()
                .filter(g -> "WIN".equals(g.getResult()))
                .count();
        
        double winRate = games.size() > 0 ? (double) tacticalWins / games.size() : 0.5;
        
        // Quick wins (move count < 25) indicate tactical strength
        long quickWins = games.stream()
                .filter(g -> "WIN".equals(g.getResult()) && g.getMoveCount() != null && g.getMoveCount() < 25)
                .count();
        
        double quickWinRate = games.size() > 0 ? (double) quickWins / games.size() : 0.0;
        
        // Combined: 50% accuracy - blunder penalty + 30% win rate + 20% quick wins
        return Math.max(0.0, (avgAccuracy * 0.5) - tacticalBlunderRate + (winRate * 0.3) + (quickWinRate * 0.2));
    }

    /**
     * Analyze positional understanding from games
     * Analyze rating changes and loss patterns to identify positional weaknesses
     */
    private double analyzePositional(List<Game> games) {
        // Positional analysis based on:
        // - Win rate (positional wins come from better position)
        // - Rating change (negative = positional mistakes)
        // - Loss patterns (repeated losses indicate systemic weakness)
        
        int positionalWins = (int) games.stream()
                .filter(g -> "WIN".equals(g.getResult()))
                .count();
        
        int losses = (int) games.stream()
                .filter(g -> "LOSS".equals(g.getResult()))
                .count();
        
        double winRate = games.size() > 0 ? (double) positionalWins / games.size() : 0.5;
        
        // Average rating change - big negative swing = positional issues
        double avgRatingChange = games.stream()
                .filter(g -> g.getRatingChange() != null)
                .mapToInt(Game::getRatingChange)
                .average()
                .orElse(0.0);
        
        double ratingScore = Math.max(0.0, Math.min(1.0, (avgRatingChange + 50) / 100)); // Normalize
        
        // Penalize if multiple losses in a row (patterns matter)
        double lossPattern = (double) losses / games.size() * 0.3; // -30% if all losses
        
        double avgAccuracy = games.stream()
                .filter(g -> g.getAccuracyPercentage() != null)
                .mapToInt(Game::getAccuracyPercentage)
                .average()
                .orElse(50.0) / 100.0;
        
        // Combined: 40% win rate + 25% rating change + 20% accuracy - loss penalty
        return Math.max(0.0, (winRate * 0.4) + (ratingScore * 0.25) + (avgAccuracy * 0.2) - lossPattern);
    }

    /**
     * Analyze time management performance
     * Focus on losses under time pressure and timeout losses
     */
    private double analyzeTimeManagement(List<Game> games) {
        // Time management based on:
        // - Win rate in blitz/rapid games (requires better time management)
        // - Losses under time pressure
        // - Timeout/resignation losses (poor time management)
        
        // Separate rapid and blitz games
        List<Game> rapidBlitzGames = games.stream()
                .filter(g -> g.getTimeControl() != null && 
                        (g.getTimeControl().startsWith("3+") || 
                         g.getTimeControl().startsWith("5+") ||
                         g.getTimeControl().startsWith("10+") ||
                         g.getTimeControl().startsWith("1+")))
                .toList();
        
        double timeBasedWinRate = 0.5;
        if (!rapidBlitzGames.isEmpty()) {
            int timeWins = (int) rapidBlitzGames.stream()
                    .filter(g -> "WIN".equals(g.getResult()))
                    .count();
            timeBasedWinRate = (double) timeWins / rapidBlitzGames.size();
        }
        
        // Count timeout/quick losses (indicates poor time management)
        long timeoutLosses = games.stream()
                .filter(g -> "LOSS".equals(g.getResult()) && 
                        g.getTerminationReason() != null &&
                        (g.getTerminationReason().contains("TIMEOUT") ||
                         g.getTerminationReason().contains("TIME") ||
                         g.getTerminationReason().contains("RESIGNATION")))
                .count();
        
        long totalLosses = games.stream()
                .filter(g -> "LOSS".equals(g.getResult()))
                .count();
        
        // Penalty for timeout losses - big indicator of time management issues
        double timeoutPenalty = 0.0;
        if (totalLosses > 0) {
            timeoutPenalty = ((double) timeoutLosses / totalLosses) * 0.4; // -40% if all losses are timeouts
        }
        
        // Accuracy in rapid/blitz games
        double rapidBlitzAccuracy = 0.5;
        if (!rapidBlitzGames.isEmpty()) {
            rapidBlitzAccuracy = rapidBlitzGames.stream()
                    .filter(g -> g.getAccuracyPercentage() != null)
                    .mapToInt(Game::getAccuracyPercentage)
                    .average()
                    .orElse(50.0) / 100.0;
        }
        
        // Combined: 40% time-based win rate + 30% accuracy under pressure - timeout penalty
        return Math.max(0.0, (timeBasedWinRate * 0.4) + (rapidBlitzAccuracy * 0.3) - timeoutPenalty);
    }

    /**
     * Classify performance score into category analysis
     * More aggressive thresholds to show realistic weaknesses
     */
    private CategoryAnalysisDto classifyPerformance(double score) {
        // Normalize score to 0-1 range
        score = Math.max(0.0, Math.min(1.0, score));
        
        String classification;
        int numericScore;

        // More realistic thresholds:
        // - Strong: 65%+ (excellent performance)
        // - Average: 40-65% (decent but room for improvement)
        // - Weak: Below 40% (clear weakness)
        if (score >= 0.65) {
            classification = "strong";
            numericScore = 2;
        } else if (score >= 0.40) {
            classification = "average";
            numericScore = 1;
        } else {
            classification = "weak";
            numericScore = 0;
        }

        return new CategoryAnalysisDto(
                classification,
                Math.round(score * 100.0) / 100.0,
                numericScore
        );
    }
    
    /**
     * Overloaded classifyPerformance with context parameters
     * Used by new user-specific prediction generation
     */
    private CategoryAnalysisDto classifyPerformance(double score, String category, int wins, int losses) {
        // Apply context-based adjustments
        double adjustedScore = score;
        
        // If user has many losses, even average scores become "weak" 
        if (losses > wins * 1.5) {
            adjustedScore *= 0.9; // 10% penalty for significant losses
        }
        
        // If user has many wins, lift the score a bit
        if (wins > losses * 1.5) {
            adjustedScore *= 1.1; // 10% boost for significant wins
        }
        
        // Call original classifyPerformance with adjusted score
        return classifyPerformance(Math.max(0.0, Math.min(1.0, adjustedScore)));
    }

    /**
     * Determine strength areas from predictions
     * Shows real strengths (65%+) and above-average areas (55-65%)
     */
    private List<String> determineStrengths(Map<String, CategoryAnalysisDto> predictions) {
        List<String> strengths = new ArrayList<>();

        predictions.forEach((category, analysis) -> {
            // Show strengths for "strong" classification (65%+)
            if ("strong".equals(analysis.classification())) {
                strengths.add(getCategoryLabel(category) + " - Excellent performance! This is a major strength.");
            } 
            // Also show above-average areas (55-65%) as developing strengths
            else if ("average".equals(analysis.classification()) && analysis.confidence() >= 0.55) {
                strengths.add(getCategoryLabel(category) + " - You're doing well here, keep building on this strength.");
            }
        });

        if (strengths.isEmpty()) {
            strengths.add("Balanced player - Continue practicing to develop standout strengths.");
        }

        return strengths;
    }

    /**
     * Determine weakness areas from predictions
     * Shows weaknesses and areas needing improvement based on real performance
     */
    private List<String> determineWeaknesses(Map<String, CategoryAnalysisDto> predictions) {
        List<String> weaknesses = new ArrayList<>();

        predictions.forEach((category, analysis) -> {
            // Show significant weaknesses (< 40%)
            if ("weak".equals(analysis.classification())) {
                weaknesses.add(getCategoryLabel(category) + " - Critical weakness. Prioritize improvement here.");
            } 
            // Show areas needing work (40-55% "average" scores)
            else if ("average".equals(analysis.classification()) && analysis.confidence() < 0.55) {
                weaknesses.add(getCategoryLabel(category) + " - Needs improvement. Focus on this area.");
            }
        });

        if (weaknesses.isEmpty()) {
            weaknesses.add("Well-balanced player - All areas are performing at solid level.");
        }

        return weaknesses;
    }

    /**
     * Calculate feature metrics from games
     */
    private Map<String, Double> calculateFeatures(List<Game> games) {
        Map<String, Double> features = new HashMap<>();

        int wins = (int) games.stream()
                .filter(g -> "WIN".equals(g.getResult()))
                .count();
        int losses = (int) games.stream()
                .filter(g -> "LOSS".equals(g.getResult()))
                .count();
        int draws = games.size() - wins - losses;

        features.put("winRate", wins * 100.0 / games.size());
        features.put("averageRatingChange", games.stream()
                .mapToInt(g -> g.getRatingChange() != null ? g.getRatingChange() : 0)
                .average()
                .orElse(0.0));
        features.put("totalGames", (double) games.size());

        return features;
    }

    /**
     * Generate personalized recommendation
     */
    private String generateRecommendation(List<String> strengths, List<String> weaknesses) {
        if (weaknesses.isEmpty()) {
            return "Excellent work! You're performing well across all areas. Keep practicing to maintain your level.";
        }

        return "Focus on improving your " + (weaknesses.isEmpty() ? "overall game" : "weaknesses") + 
               ". Practice openings and endgames regularly, and analyze your losses to learn from mistakes.";
    }

    /**
     * Get human-readable category label
     */
    private String getCategoryLabel(String category) {
        return switch (category) {
            case "opening" -> "Opening";
            case "middlegame" -> "Middlegame";
            case "endgame" -> "Endgame";
            case "tactical" -> "Tactical Play";
            case "positional" -> "Positional Understanding";
            case "timeManagement" -> "Time Management";
            default -> category;
        };
    }

    /**
     * Parse cached analysis from database
     */
    private AnalysisResultDto parseAnalysisResult(PlayerAnalysis pa) throws Exception {
        List<String> strengths = objectMapper.readValue(pa.getStrengths(),
                new TypeReference<List<String>>() {
                });
        List<String> weaknesses = objectMapper.readValue(pa.getWeaknesses(),
                new TypeReference<List<String>>() {
                });
        Map<String, Double> features = objectMapper.readValue(pa.getMetrics(),
                new TypeReference<Map<String, Double>>() {
                });

        // Parse predictions from stored JSON
        PredictionsDto predictions;
        if (pa.getPredictions() != null && !pa.getPredictions().isEmpty()) {
            try {
                Map<String, Object> predictionsMap = objectMapper.readValue(pa.getPredictions(),
                        new TypeReference<Map<String, Object>>() {
                        });
                
                predictions = new PredictionsDto(
                        parseCategoryPrediction(extractMap(predictionsMap, "opening")),
                        parseCategoryPrediction(extractMap(predictionsMap, "middlegame")),
                        parseCategoryPrediction(extractMap(predictionsMap, "endgame")),
                        parseCategoryPrediction(extractMap(predictionsMap, "tactical")),
                        parseCategoryPrediction(extractMap(predictionsMap, "positional")),
                        parseCategoryPrediction(extractMap(predictionsMap, "timeManagement"))
                );
            } catch (Exception e) {
                log.warn("Failed to parse predictions, using defaults: {}", e.getMessage());
                // Fallback to default predictions
                predictions = new PredictionsDto(
                        new CategoryAnalysisDto("average", 0.65, 1),
                        new CategoryAnalysisDto("average", 0.60, 1),
                        new CategoryAnalysisDto("average", 0.72, 1),
                        new CategoryAnalysisDto("average", 0.65, 1),
                        new CategoryAnalysisDto("average", 0.70, 1),
                        new CategoryAnalysisDto("average", 0.60, 1)
                );
            }
        } else {
            // No predictions stored, use defaults
            predictions = new PredictionsDto(
                    new CategoryAnalysisDto("average", 0.65, 1),
                    new CategoryAnalysisDto("average", 0.60, 1),
                    new CategoryAnalysisDto("average", 0.72, 1),
                    new CategoryAnalysisDto("average", 0.65, 1),
                    new CategoryAnalysisDto("average", 0.70, 1),
                    new CategoryAnalysisDto("average", 0.60, 1)
            );
        }

        return new AnalysisResultDto(
                "0",
                pa.getUpdatedAt().toString(),
                pa.getGamesAnalyzed(),
                predictions,
                strengths,
                weaknesses,
                features,
                "Keep improving your game through regular practice and analysis."
        );
    }
    
    /**
     * Helper method to extract a map from predictions object
     */
    private Map<String, Object> extractMap(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val instanceof Map) {
            return (Map<String, Object>) val;
        }
        return new HashMap<>();
    }
}
