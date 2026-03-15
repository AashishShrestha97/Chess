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
 * Service for calling the Python ML inference API.
 *
 * <p>Only passes <em>complete</em> games to the ML server — games that are
 * too short (e.g. quick resigns / disconnects) are already filtered by
 * {@link ChessGameService#getRecentGamesForML}. This means the counts
 * checked here always refer to qualifying games, never to all games.</p>
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

    // ─────────────────────────────────────────────────────────────────────────

    /** Analyse using the default minimum game count. */
    public MLAnalysisResponse analyzePlayer(User user, String playerName) {
        return analyzePlayer(user, playerName, minGamesForAnalysis);
    }

    /**
     * Analyse with a specific game count.
     *
     * <p>Callers (e.g. {@code ProfileController}) are expected to have already
     * verified that enough complete games exist via
     * {@link ChessGameService#countMLWorthyGames}. This method still validates
     * and throws {@link IllegalArgumentException} if the constraint is not met,
     * acting as a safety net.</p>
     */
    public MLAnalysisResponse analyzePlayer(User user, String playerName, int gameCount) {
        log.info("🔍 ML analysis for user={} ({}), requested games={}",
                user.getId(), playerName, gameCount);

        if (!mlApiEnabled) {
            log.warn("⚠️ ML API is disabled in configuration");
            throw new RuntimeException("ML analysis service is not enabled");
        }

        // Clamp to valid range
        gameCount = Math.max(minGamesForAnalysis, Math.min(maxGamesForAnalysis, gameCount));

        try {
            // Fetch only ML-worthy (complete) games
            var userGames = chessGameService.getRecentGamesForML(user, gameCount);

            if (userGames.isEmpty()) {
                throw new IllegalArgumentException(
                        "You have no complete games for analysis. " +
                        "Play at least " + gameCount + " games with 10+ moves each.");
            }

            if (userGames.size() < gameCount) {
                throw new IllegalArgumentException(
                        "Not enough complete games: found " + userGames.size() +
                        ", need " + gameCount + ". " +
                        "Complete games must have at least 10 moves. " +
                        "Very short games (resigns, disconnects) do not count.");
            }

            log.info("✅ Sending {} complete games to ML API", userGames.size());

            MLAnalysisRequest request = new MLAnalysisRequest(
                    String.valueOf(user.getId()),
                    user.getName() != null ? user.getName() : user.getEmail(),
                    userGames);

            MLAnalysisResponse response = callPythonMLAPI(request);

            if (response == null) {
                throw new RuntimeException("ML API returned null response");
            }

            log.info("✅ ML analysis done — categories={}, strengths={}, weaknesses={}",
                    "6",
                    response.getStrengths() != null ? response.getStrengths().size() : 0,
                    response.getWeaknesses() != null ? response.getWeaknesses().size() : 0);

            return response;

        } catch (IllegalArgumentException e) {
            log.warn("⚠️ Validation failed: {}", e.getMessage());
            throw e;
        } catch (RestClientException e) {
            log.error("❌ HTTP error calling ML API: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to call ML analysis service: " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("❌ Unexpected error during ML analysis: {}", e.getMessage(), e);
            throw new RuntimeException("Error during ML analysis: " + e.getMessage(), e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HTTP call
    // ─────────────────────────────────────────────────────────────────────────

    private MLAnalysisResponse callPythonMLAPI(MLAnalysisRequest request) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Accept", MediaType.APPLICATION_JSON_VALUE);

        HttpEntity<MLAnalysisRequest> httpRequest = new HttpEntity<>(request, headers);

        log.debug("POST {} with {} games", mlApiUrl, request.getGames().size());

        @SuppressWarnings("unchecked")
        Map<String, Object> rawResponse = restTemplate.postForObject(
                mlApiUrl, httpRequest, Map.class);

        if (rawResponse == null) {
            log.error("❌ ML API returned null");
            return null;
        }

        log.info("✅ ML API response keys: {}", rawResponse.keySet());
        return convertMapToMLAnalysisResponse(rawResponse);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Response conversion (unchanged from original)
    // ─────────────────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private MLAnalysisResponse convertMapToMLAnalysisResponse(Map<String, Object> rawResponse) {
        try {
            String userId    = (String) rawResponse.getOrDefault("user_id", "0");
            String timestamp = (String) rawResponse.getOrDefault("timestamp",
                    java.time.Instant.now().toString());

            Integer gamesAnalyzed = 1;
            Object gaObj = rawResponse.get("games_analyzed");
            if (gaObj instanceof Number) gamesAnalyzed = ((Number) gaObj).intValue();

            List<String> strengths  = (List<String>) rawResponse.getOrDefault("strengths",  new ArrayList<>());
            List<String> weaknesses = (List<String>) rawResponse.getOrDefault("weaknesses", new ArrayList<>());

            Map<String, Double> features = new HashMap<>();
            Object fObj = rawResponse.get("features");
            if (fObj instanceof Map) {
                ((Map<String, Object>) fObj).forEach((k, v) -> {
                    if (v instanceof Number) features.put(k, ((Number) v).doubleValue());
                });
            }

            String recommendation = (String) rawResponse.getOrDefault("recommendation", "");

            MLPredictions predictions = new MLPredictions();

            if (rawResponse.containsKey("categories") && rawResponse.get("categories") instanceof List) {
                // Test-app "categories" array format
                for (Object item : (List<?>) rawResponse.get("categories")) {
                    if (!(item instanceof Map)) continue;
                    Map<String, Object> cat = (Map<String, Object>) item;
                    String catName = normalizeCategoryName(
                            String.valueOf(cat.getOrDefault("category", "unknown")).toLowerCase());
                    String classification = (String) cat.getOrDefault("classification", "average");
                    Integer numericScore  = 50;
                    Double  confidence    = 0.5;
                    Object nsObj = cat.get("numeric_score");
                    if (nsObj instanceof Number) {
                        numericScore = ((Number) nsObj).intValue();
                        confidence   = numericScore / 100.0;
                    } else {
                        Object scoreObj = cat.get("score");
                        if (scoreObj instanceof Number) {
                            int sv = ((Number) scoreObj).intValue();
                            numericScore = sv * 25;
                            confidence   = sv / 4.0;
                        }
                    }
                    assignPrediction(predictions, catName,
                            new MLCategoryPrediction(classification, confidence, numericScore));
                }
            } else if (rawResponse.containsKey("predictions") && rawResponse.get("predictions") instanceof Map) {
                // Standard "predictions" map format
                Map<String, Object> preds = (Map<String, Object>) rawResponse.get("predictions");
                for (Map.Entry<String, Object> entry : preds.entrySet()) {
                    if (!(entry.getValue() instanceof Map)) continue;
                    Map<String, Object> pred = (Map<String, Object>) entry.getValue();
                    String normalizedKey = normalizeCategoryName(entry.getKey());

                    String  classification = (String) pred.getOrDefault("classification", "average");
                    Double  confidence     = 0.5;
                    Integer numericScore   = 50;

                    Object conf = pred.get("confidence");
                    if (conf instanceof Number) {
                        double c = ((Number) conf).doubleValue();
                        if (c > 1) c = c / 100.0;
                        confidence = Math.max(0.0, Math.min(1.0, c));
                    }
                    Object num = pred.get("numeric_score");
                    if (num instanceof Number) numericScore = ((Number) num).intValue();

                    assignPrediction(predictions, normalizedKey,
                            new MLCategoryPrediction(classification, confidence, numericScore));
                }
            }

            // Fill in any missing categories with defaults
            if (predictions.getOpening()        == null) predictions.setOpening(defaultPred());
            if (predictions.getMiddlegame()      == null) predictions.setMiddlegame(defaultPred());
            if (predictions.getEndgame()         == null) predictions.setEndgame(defaultPred());
            if (predictions.getStrategy()        == null) predictions.setStrategy(defaultPred());
            if (predictions.getTactical()        == null) predictions.setTactical(defaultPred());
            if (predictions.getTimeManagement()  == null) predictions.setTimeManagement(defaultPred());

            MLAnalysisResponse response = new MLAnalysisResponse();
            response.setUserId(userId);
            response.setTimestamp(timestamp);
            response.setGamesAnalyzed(gamesAnalyzed);
            response.setPredictions(predictions);
            response.setStrengths(strengths);
            response.setWeaknesses(weaknesses);
            response.setFeatures(features);
            response.setRecommendation(recommendation);
            return response;

        } catch (Exception e) {
            log.error("❌ Error converting ML API response: {}", e.getMessage(), e);
            return null;
        }
    }

    private void assignPrediction(MLPredictions predictions, String key, MLCategoryPrediction pred) {
        switch (key) {
            case "opening":         predictions.setOpening(pred);         break;
            case "middlegame":      predictions.setMiddlegame(pred);      break;
            case "endgame":         predictions.setEndgame(pred);         break;
            case "positional":      predictions.setStrategy(pred);        break;
            case "tactical":        predictions.setTactical(pred);        break;
            case "time_management": predictions.setTimeManagement(pred);  break;
        }
    }

    private String normalizeCategoryName(String name) {
        if (name.contains("opening"))                           return "opening";
        if (name.contains("middle"))                            return "middlegame";
        if (name.contains("endgame"))                           return "endgame";
        if (name.contains("tactic"))                            return "tactical";
        if (name.contains("position") || name.contains("strategy")) return "positional";
        if (name.contains("time"))                              return "time_management";
        return name;
    }

    private MLCategoryPrediction defaultPred() {
        return new MLCategoryPrediction("average", 0.5, 50);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Health / availability
    // ─────────────────────────────────────────────────────────────────────────

    public MLHealthResponse checkMLHealth() {
        try {
            String healthUrl = mlApiUrl.replace("/analyze-player", "/health");
            return restTemplate.getForObject(healthUrl, MLHealthResponse.class);
        } catch (Exception e) {
            log.warn("⚠️ Failed to check ML API health: {}", e.getMessage());
            return null;
        }
    }

    public boolean isMLServiceAvailable() {
        if (!mlApiEnabled) return false;
        try {
            MLHealthResponse h = checkMLHealth();
            return h != null && "ok".equalsIgnoreCase(h.getStatus());
        } catch (Exception e) {
            return false;
        }
    }
}