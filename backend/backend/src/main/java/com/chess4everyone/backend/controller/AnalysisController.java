package com.chess4everyone.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.chess4everyone.backend.dto.MLAnalysisResponse;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.repo.UserRepository;
import com.chess4everyone.backend.service.ChessMLAnalysisService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * API Controller for Player Analysis using ML Models
 * 
 * Endpoints:
 * - GET /api/analysis/player - Analyze current user's games with ML models
 * - GET /api/analysis/player/cached - Get cached analysis if available
 * 
 * Analyzes the user's 10 most recent games using trained ML models:
 * - opening_model.pkl: Opening phase performance
 * - middlegame_model.pkl: Middlegame phase performance
 * - endgame_model.pkl: Endgame phase performance
 * - strategy_model.pkl: Strategic play classification
 * - tactics_model.pkl: Tactical play classification
 * - time_management_model.pkl: Time management classification
 */
@RestController
@RequestMapping("/api/analysis")
@RequiredArgsConstructor
@Slf4j
public class AnalysisController {
    
    private final ChessMLAnalysisService chessMLAnalysisService;
    private final UserRepository userRepository;
    
    /**
     * Analyze current player's games using ML models
     * Requires at least 10 games to analyze
     * 
     * @param authentication Spring Security authentication
     * @return ML analysis with predictions for opening, middlegame, endgame, strategy, tactics, time management
     */
    @GetMapping("/player")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MLAnalysisResponse> analyzePlayer(Authentication authentication) {
        try {
            log.info("📊 Analysis request from user: {}", authentication.getName());
            
            // Get current user by ID (authentication.getName() returns user ID from JWT subject)
            User user = userRepository.findById(Long.valueOf(authentication.getName()))
                .orElseThrow(() -> new RuntimeException("User not found"));
            
            // Analyze using ML models
            MLAnalysisResponse analysis = chessMLAnalysisService.analyzePlayer(user, user.getName());
            
            log.info("✅ Analysis completed for user: {}", user.getId());
            return ResponseEntity.ok(analysis);
            
        } catch (IllegalArgumentException e) {
            log.warn("⚠️ Not enough games or invalid ID: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        } catch (RuntimeException e) {
            log.error("❌ Error analyzing player: {}", e.getMessage());
            return ResponseEntity.status(404).build();
        } catch (Exception e) {
            log.error("❌ Unexpected error analyzing player: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Get cached analysis if available
     * Returns previously computed analysis without running a new one
     * 
     * @param authentication Spring Security authentication
     * @return Cached ML analysis or null if not available
     */
    @GetMapping("/player/cached")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MLAnalysisResponse> getCachedAnalysis(Authentication authentication) {
        try {
            log.info("📦 Cached analysis request from user: {}", authentication.getName());
            
            // Try to get cached analysis
            // For now, return empty - would need to implement caching in database
            log.info("ℹ️ No cached analysis implementation yet");
            return ResponseEntity.notFound().build();
            
        } catch (Exception e) {
            log.error("❌ Error retrieving cached analysis: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Force re-analysis of player games
     * Useful when user wants fresh analysis after playing new games
     * 
     * @param authentication Spring Security authentication
     * @return Fresh ML analysis
     */
    @PostMapping("/player/refresh")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MLAnalysisResponse> refreshAnalysis(Authentication authentication) {
        try {
            log.info("🔄 Refresh analysis request from user: {}", authentication.getName());
            
            // Get current user by ID
            User user = userRepository.findById(Long.valueOf(authentication.getName()))
                .orElseThrow(() -> new RuntimeException("User not found"));
            
            // Force fresh analysis
            MLAnalysisResponse analysis = chessMLAnalysisService.analyzePlayer(user, user.getName());
            
            log.info("✅ Analysis refreshed for user: {}", user.getId());
            return ResponseEntity.ok(analysis);
            
        } catch (IllegalArgumentException e) {
            log.warn("⚠️ Cannot refresh: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        } catch (RuntimeException e) {
            log.error("❌ Error refreshing analysis: {}", e.getMessage());
            return ResponseEntity.status(404).build();
        } catch (Exception e) {
            log.error("❌ Unexpected error refreshing analysis: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }
}
