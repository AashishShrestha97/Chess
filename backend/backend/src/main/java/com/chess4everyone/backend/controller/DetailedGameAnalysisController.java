package com.chess4everyone.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.chess4everyone.backend.dto.DetailedGameAnalysisDTO;
import com.chess4everyone.backend.entity.Game;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.repo.UserRepository;
import com.chess4everyone.backend.repository.GameRepository;
import com.chess4everyone.backend.service.DetailedGameAnalysisService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Detailed Game Analysis Controller
 * Provides move-by-move analysis using Stockfish engine (like Chess.com)
 */
@RestController
@RequestMapping("/api/games/{gameId}/detailed-analysis")
@RequiredArgsConstructor
@Slf4j
public class DetailedGameAnalysisController {

    private final DetailedGameAnalysisService analysisService;
    private final GameRepository gameRepository;
    private final UserRepository userRepository;

    /**
     * Get detailed move-by-move analysis for a game using Stockfish
     * POST /api/games/{gameId}/detailed-analysis
     * 
     * @param gameId The game ID to analyze
     * @param authentication The authenticated user
     * @return Detailed game analysis with evaluations, best moves, etc.
     */
    @PostMapping
    public ResponseEntity<?> analyzeGame(
            @PathVariable Long gameId,
            Authentication authentication) {
        
        try {
            log.info("🔍 Detailed analysis request for game: {}", gameId);
            
            // Get the game
            Game game = gameRepository.findById(gameId)
                    .orElseThrow(() -> new RuntimeException("Game not found"));
            
            // Verify ownership
            User user = userRepository.findById(Long.valueOf(authentication.getName()))
                    .orElseThrow(() -> new RuntimeException("User not found"));
            
            if (!game.getUser().getId().equals(user.getId())) {
                log.warn("⚠️ User {} attempted to analyze game {} owned by {}", 
                    user.getId(), gameId, game.getUser().getId());
                return ResponseEntity.status(403).body("Access denied");
            }
            
            log.info("📊 Analyzing game {} for user: {}", gameId, user.getName());
            
            // Perform detailed analysis using Stockfish
            DetailedGameAnalysisDTO analysis = analysisService.analyzeGameDetailed(game);
            
            log.info("✅ Analysis complete for game: {}", gameId);
            return ResponseEntity.ok(analysis);
            
        } catch (Exception e) {
            log.error("❌ Analysis failed: {}", e.getMessage(), e);
            return ResponseEntity.status(500)
                    .body("Analysis failed: " + e.getMessage());
        }
    }

    /**
     * Check if Stockfish is available for analysis
     */
    @GetMapping("/status")
    public ResponseEntity<?> checkStatus() {
        boolean available = analysisService.isStockfishAvailable();
        return ResponseEntity.ok(java.util.Map.of(
            "stockfish_available", available,
            "status", available ? "Ready for analysis" : "Stockfish not available"
        ));
    }
}
