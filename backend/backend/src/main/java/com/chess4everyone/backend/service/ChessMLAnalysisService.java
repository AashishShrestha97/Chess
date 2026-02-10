package com.chess4everyone.backend.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import com.chess4everyone.backend.dto.MLAnalysisRequest;
import com.chess4everyone.backend.dto.MLAnalysisResponse;
import com.chess4everyone.backend.dto.MLCategoryPrediction;
import com.chess4everyone.backend.dto.MLHealthResponse;
import com.chess4everyone.backend.dto.MLPredictions;
import com.chess4everyone.backend.entity.User;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Service for calling Python ML inference API
 * Handles communication with FastAPI server running on port 8000
 * 
 * Architecture:
 * React Frontend (port 3000)
 *     ↓ HTTP
 * Spring Boot Backend (port 8080) ← YOU ARE HERE
 *     ↓ HTTP REST (ChessMLAnalysisService)
 * Python ML Server (port 8000)
 *     ↓
 * Trained ML Models + Stockfish Chess Engine
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChessMLAnalysisService {
    
    private final RestTemplate restTemplate;
    private final ChessGameService chessGameService;
    
    @Value("${chess.ml.api.url:http://localhost:8000/analyze-player}")
    private String mlApiUrl;
    
    @Value("${chess.ml.api.enabled:false}")
    private boolean mlApiEnabled;
    
    @Value("${chess.ml.min-games:10}")
    private int minGamesForAnalysis;
    
    @Value("${chess.ml.max-games:20}")
    private int maxGamesForAnalysis;
    
    /**
     * Analyze player by calling Python ML API
     * @param user The user to analyze
     * @param playerName The player name/username
     * @return ML analysis response with predictions
     */
    public MLAnalysisResponse analyzePlayer(User user, String playerName) {
        return analyzePlayer(user, playerName, minGamesForAnalysis);
    }
    
    /**
     * Analyze player with specific number of games
     * @param user The user to analyze
     * @param playerName The player name/username
     * @param gameCount Number of recent games to analyze (1-20)
     * @return ML analysis response with predictions and recommendations
     */
    public MLAnalysisResponse analyzePlayer(User user, String playerName, int gameCount) {
        log.info("🔍 Starting ML analysis for user: {} ({})", user.getId(), playerName);
        
        if (!mlApiEnabled) {
            log.warn("⚠️ ML API is disabled in configuration");
            throw new RuntimeException("ML analysis service is not enabled");
        }
        
        // Validate and clamp game count between 1 and maxGamesForAnalysis
        if (gameCount < 1) {
            gameCount = 1;
        }
        if (gameCount > maxGamesForAnalysis) {
            gameCount = maxGamesForAnalysis;
        }
        
        try {
            // Check if user has enough games
            var userGames = chessGameService.getRecentGamesForML(user, gameCount);
            if (userGames.isEmpty()) {
                log.error("❌ User has no games to analyze");
                throw new IllegalArgumentException("User has no games to analyze");
            }
            
            if (userGames.size() < gameCount) {
                log.error("❌ Not enough games: {} available, need at least {} for ML analysis", 
                    userGames.size(), gameCount);
                throw new IllegalArgumentException(
                    "Need at least " + gameCount + " games for analysis. You have " + userGames.size()
                );
            }
            
            log.info("✅ Have {} valid games for analysis", userGames.size());
            
            // Build ML API request
            MLAnalysisRequest request = new MLAnalysisRequest(
                String.valueOf(user.getId()),
                user.getName() != null ? user.getName() : user.getEmail(),
                userGames
            );
            
            log.info("📊 Calling Python ML API at: {}", mlApiUrl);
            log.info("   Games to analyze: {}", userGames.size());
            log.info("   Using trained ML models (opening, middlegame, endgame, strategy, tactics, time_management)");
            
            // Log games details for debugging
            for (int i = 0; i < Math.min(3, userGames.size()); i++) {
                String pgn = userGames.get(i).getPgn();
                int pgnLength = pgn != null ? pgn.length() : 0;
                int moveCount = pgn != null ? pgn.split("\\d+\\.").length - 1 : 0;
                log.debug("   Game {}: {} bytes, ~{} moves", i+1, pgnLength, moveCount);
                if (pgn != null && pgn.length() < 200) {
                    log.debug("      Content: {}", pgn);
                }
            }
            
            // Call Python ML API
            MLAnalysisResponse response = callPythonMLAPI(request);
            
            if (response == null) {
                log.error("❌ ML API returned null response");
                throw new RuntimeException("ML API returned null response");
            }
            
            log.info("✅ ML analysis completed successfully");
            log.info("   Categories analyzed: {}", response.getPredictions() != null ? "6" : "0");
            log.info("   Strengths found: {}", response.getStrengths() != null ? response.getStrengths().size() : 0);
            log.info("   Weaknesses found: {}", response.getWeaknesses() != null ? response.getWeaknesses().size() : 0);
            
            return response;
            
        } catch (IllegalArgumentException e) {
            log.warn("⚠️ Invalid request: {}", e.getMessage());
            throw e;
        } catch (RestClientException e) {
            log.error("❌ Failed to call Python ML API: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to call ML analysis service: " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("❌ Unexpected error during ML analysis: {}", e.getMessage(), e);
            throw new RuntimeException("Error during ML analysis: " + e.getMessage(), e);
        }
    }
    
    /**
     * Make HTTP POST request to Python ML API
     * @param request Analysis request with games
     * @return ML analysis response
     */
    private MLAnalysisResponse callPythonMLAPI(MLAnalysisRequest request) {
        try {
            log.debug("Preparing HTTP request to ML API");
            
            // Set up headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Accept", MediaType.APPLICATION_JSON_VALUE);
            
            // Create request entity
            HttpEntity<MLAnalysisRequest> httpRequest = new HttpEntity<>(request, headers);
            
            log.debug("Sending {} games to ML API", request.getGames().size());
            
            // Call Python API - deserialize as Map first to handle variable response formats
            Map<String, Object> rawResponse = restTemplate.postForObject(
                mlApiUrl,
                httpRequest,
                Map.class
            );
            
            if (rawResponse == null) {
                log.error("❌ ML API returned null response");
                return null;
            }
            
            log.info("✅ Received response from Python API");
            log.info("   Response keys: {}", rawResponse.keySet());
            
            // Convert raw response to MLAnalysisResponse with proper handling of test app format
            MLAnalysisResponse response = convertMapToMLAnalysisResponse(rawResponse);
            
            if (response != null) {
                log.debug("   User: {}, Games analyzed: {}", 
                    response.getUserId(), response.getGamesAnalyzed());
            }
            
            return response;
            
        } catch (RestClientException e) {
            log.error("HTTP Error calling ML API: {}", e.getMessage());
            throw new RuntimeException("Failed to communicate with ML API: " + e.getMessage(), e);
        }
    }
    
    /**
     * Convert raw API response (Map) to MLAnalysisResponse
     * Handles both test app format (categories array) and standard format
     */
    @SuppressWarnings("unchecked")
    private MLAnalysisResponse convertMapToMLAnalysisResponse(Map<String, Object> rawResponse) {
        try {
            String userId = (String) rawResponse.getOrDefault("user_id", "0");
            String timestamp = (String) rawResponse.getOrDefault("timestamp", java.time.Instant.now().toString());
            Integer gamesAnalyzed = 1;
            Object gaObj = rawResponse.get("games_analyzed");
            if (gaObj instanceof Number) gamesAnalyzed = ((Number) gaObj).intValue();
            
            List<String> strengths = (List<String>) rawResponse.getOrDefault("strengths", new ArrayList<>());
            List<String> weaknesses = (List<String>) rawResponse.getOrDefault("weaknesses", new ArrayList<>());
            
            Map<String, Double> features = new HashMap<>();
            Object fObj = rawResponse.get("features");
            if (fObj instanceof Map) {
                Map<String, Object> fMap = (Map<String, Object>) fObj;
                for (String key : fMap.keySet()) {
                    Object val = fMap.get(key);
                    if (val instanceof Number) features.put(key, ((Number) val).doubleValue());
                }
            }
            
            String recommendation = (String) rawResponse.getOrDefault("recommendation", "");
            
            // Create MLPredictions container
            MLPredictions predictions = new MLPredictions();
            
            // CRITICAL: Handle test app's "categories" array format
            if (rawResponse.containsKey("categories") && rawResponse.get("categories") instanceof List) {
                log.info("📋 Converting test app 'categories' array to predictions");
                List<?> categories = (List<?>) rawResponse.get("categories");
                
                for (Object item : categories) {
                    if (!(item instanceof Map)) continue;
                    Map<String, Object> cat = (Map<String, Object>) item;
                    
                    String catName = (String) cat.getOrDefault("category", "unknown");
                    catName = catName.toLowerCase().trim();
                    
                    String classification = (String) cat.getOrDefault("classification", "average");
                    
                    // Try to get numeric_score first (Python ML format 0-100), fallback to score (0-4)
                    Integer numericScore = 50;
                    Double confidence = 0.5;
                    
                    Object numScoreObj = cat.get("numeric_score");
                    if (numScoreObj instanceof Number) {
                        // Keep numeric_score as 0-100 (player skill level)
                        numericScore = ((Number) numScoreObj).intValue();
                        confidence = numericScore / 100.0;
                    } else {
                        // Fallback to 0-4 score format (convert to 0-100)
                        Integer score = null;
                        Object scoreObj = cat.get("score");
                        if (scoreObj instanceof Number) score = ((Number) scoreObj).intValue();
                        
                        if (score != null && score >= 0 && score <= 4) {
                            numericScore = (int) (score * 25);  // Convert 0-4 to 0-100
                            confidence = score / 4.0;
                        }
                    }
                    
                    MLCategoryPrediction pred = new MLCategoryPrediction();
                    pred.setClassification(classification);
                    pred.setConfidence(confidence);
                    pred.setNumericScore(numericScore);
                    
                    // Assign to correct category field
                    String normalizedName = normalizeCategoryName(catName);
                    switch (normalizedName) {
                        case "opening":
                            predictions.setOpening(pred);
                            break;
                        case "middlegame":
                            predictions.setMiddlegame(pred);
                            break;
                        case "endgame":
                            predictions.setEndgame(pred);
                            break;
                        case "positional":
                            predictions.setStrategy(pred);
                            break;
                        case "tactical":
                            predictions.setTactical(pred);
                            break;
                        case "time_management":
                            predictions.setTimeManagement(pred);
                            break;
                    }
                    
                    log.debug("   {}: classification={}, numeric={}, confidence={}", catName, classification, numericScore, confidence);
                }
            } 
            // Fall back to standard predictions format
            else if (rawResponse.containsKey("predictions") && rawResponse.get("predictions") instanceof Map) {
                log.info("📊 Using standard 'predictions' map format");
                Map<String, Object> preds = (Map<String, Object>) rawResponse.get("predictions");
                
                for (String key : preds.keySet()) {
                    Object val = preds.get(key);
                    if (val instanceof Map) {
                        Map<String, Object> pred = (Map<String, Object>) val;
                        MLCategoryPrediction catPred = new MLCategoryPrediction();
                        catPred.setClassification((String) pred.getOrDefault("classification", "average"));
                        
                        Object conf = pred.get("confidence");
                        if (conf instanceof Number) {
                            double c = ((Number) conf).doubleValue();
                            if (c > 1) c = c / 100.0;
                            catPred.setConfidence(c);
                        }
                        
                        Object num = pred.get("numeric_score");
                        if (num instanceof Number) {
                            int rawScore = ((Number) num).intValue();
                            // Keep numeric_score as 0-100 (player skill level)
                            catPred.setNumericScore(rawScore);
                        }
                        
                        // Normalize category name to handle variations like "positional" vs "strategy"
                        String normalizedKey = normalizeCategoryName(key);
                        
                        switch (normalizedKey) {
                            case "opening":
                                predictions.setOpening(catPred);
                                break;
                            case "middlegame":
                                predictions.setMiddlegame(catPred);
                                break;
                            case "endgame":
                                predictions.setEndgame(catPred);
                                break;
                            case "positional":
                                predictions.setStrategy(catPred);
                                break;
                            case "tactical":
                                predictions.setTactical(catPred);
                                break;
                            case "time_management":
                                predictions.setTimeManagement(catPred);
                                break;
                        }
                        
                        log.debug("   {}: classification={}, confidence={}, numeric={}", normalizedKey, catPred.getClassification(), catPred.getConfidence(), catPred.getNumericScore());
                    }
                }
            }
            
            // Ensure all predictions are initialized with defaults if not already set
            if (predictions.getOpening() == null) {
                predictions.setOpening(new MLCategoryPrediction("average", 0.5, 50));
            }
            if (predictions.getMiddlegame() == null) {
                predictions.setMiddlegame(new MLCategoryPrediction("average", 0.5, 50));
            }
            if (predictions.getEndgame() == null) {
                predictions.setEndgame(new MLCategoryPrediction("average", 0.5, 50));
            }
            if (predictions.getStrategy() == null) {
                predictions.setStrategy(new MLCategoryPrediction("average", 0.5, 50));
            }
            if (predictions.getTactical() == null) {
                predictions.setTactical(new MLCategoryPrediction("average", 0.5, 50));
            }
            if (predictions.getTimeManagement() == null) {
                predictions.setTimeManagement(new MLCategoryPrediction("average", 0.5, 50));
            }
            
            // Create MLAnalysisResponse
            MLAnalysisResponse response = new MLAnalysisResponse();
            response.setUserId(userId);
            response.setTimestamp(timestamp);
            response.setGamesAnalyzed(gamesAnalyzed);
            response.setPredictions(predictions);
            response.setStrengths(strengths);
            response.setWeaknesses(weaknesses);
            response.setFeatures(features);
            response.setRecommendation(recommendation);
            
            log.info("✅ Converted response with real scores");
            
            return response;
            
        } catch (Exception e) {
            log.error("❌ Error converting ML API response: {}", e.getMessage(), e);
            return null;
        }
    }
    
    /**
     * Normalize category name to standard key
     */
    private String normalizeCategoryName(String name) {
        if (name.contains("opening")) return "opening";
        if (name.contains("middle")) return "middlegame";
        if (name.contains("endgame")) return "endgame";
        if (name.contains("tactic")) return "tactical";
        if (name.contains("position") || name.contains("strategy")) return "positional";
        if (name.contains("time")) return "time_management";
        return name;
    }
    
    /**
     * Check health status of ML API server
     * @return Health status response
     */
    public MLHealthResponse checkMLHealth() {
        try {
            String healthUrl = mlApiUrl.replace("/analyze-player", "/health");
            log.debug("Checking ML API health at: {}", healthUrl);
            
            MLHealthResponse health = restTemplate.getForObject(
                healthUrl,
                MLHealthResponse.class
            );
            
            if (health != null) {
                log.info("✅ ML API Health: {}", health.getStatus());
                log.info("   Classifier ready: {}", health.getClassifierReady());
                log.info("   Stockfish available: {}", health.getStockfishAvailable());
            }
            
            return health;
            
        } catch (Exception e) {
            log.warn("⚠️ Failed to check ML API health: {}", e.getMessage());
            return null;
        }
    }
    
    /**
     * Verify ML API is accessible and configured
     * @return true if ML API is available and enabled
     */
    public boolean isMLServiceAvailable() {
        if (!mlApiEnabled) {
            log.debug("ML service is disabled in configuration");
            return false;
        }
        
        try {
            MLHealthResponse health = checkMLHealth();
            return health != null && "ok".equalsIgnoreCase(health.getStatus());
        } catch (Exception e) {
            log.debug("ML service not available: {}", e.getMessage());
            return false;
        }
    }
}
