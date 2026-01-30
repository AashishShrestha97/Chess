package com.chess4everyone.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import com.chess4everyone.backend.dto.MLAnalysisRequest;
import com.chess4everyone.backend.dto.MLAnalysisResponse;
import com.chess4everyone.backend.dto.MLHealthResponse;
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
        
        // Validate game count
        if (gameCount < minGamesForAnalysis) {
            gameCount = minGamesForAnalysis;
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
            
            if (userGames.size() < 5) {
                log.error("❌ Not enough games: {} available, need at least 5", 
                    userGames.size());
                throw new IllegalArgumentException(
                    "Need at least 5 games for analysis. You have " + userGames.size()
                );
            }
            
            log.info("✅ Have {} valid games for analysis", userGames.size());
            
            // Build ML API request
            MLAnalysisRequest request = new MLAnalysisRequest(
                String.valueOf(user.getId()),
                playerName,
                userGames
            );
            
            log.info("📊 Calling Python ML API at: {}", mlApiUrl);
            log.info("   Games to analyze: {}", userGames.size());
            
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
            
            // Call Python API
            MLAnalysisResponse response = restTemplate.postForObject(
                mlApiUrl,
                httpRequest,
                MLAnalysisResponse.class
            );
            
            if (response != null) {
                log.debug("✅ Received response from ML API");
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
