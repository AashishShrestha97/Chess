package com.chess4everyone.backend.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.chess4everyone.backend.dto.GameAnalysisDto;
import com.chess4everyone.backend.dto.GameDetailDto;
import com.chess4everyone.backend.dto.RecentGameDto;
import com.chess4everyone.backend.dto.SaveGameRequest;
import com.chess4everyone.backend.entity.Game;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.repo.UserRepository;
import com.chess4everyone.backend.security.JwtService;
import com.chess4everyone.backend.service.GameService;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/games")
public class GameController {

    private final GameService gameService;
    private final UserRepository userRepository;
    private final JwtService jwtService;

    public GameController(GameService gameService,
                        UserRepository userRepository,
                        JwtService jwtService) {
        this.gameService = gameService;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
    }

    /**
     * Extract user ID from JWT token in cookies
     */
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
        
        return subject != null ? Long.valueOf(subject) : null;
    }

    /**
     * POST /api/games/save
     * Save a completed game
     */
    @PostMapping("/save")
    public ResponseEntity<?> saveGame(HttpServletRequest req, @RequestBody SaveGameRequest saveRequest) {
        System.out.println("💾 POST /api/games/save - Saving game");
        
        Long userId = getUserIdFromRequest(req);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of(
                "error", "Unauthorized",
                "message", "Please log in to save games"
            ));
        }

        try {
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
            
            // Calculate rating change (simplified)
            Integer ratingChange = calculateRatingChange(saveRequest);
            
            Game savedGame = gameService.saveGame(user, saveRequest, ratingChange);
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "gameId", savedGame.getId(),
                "message", "Game saved successfully"
            ));
            
        } catch (Exception e) {
            System.out.println("❌ Error saving game: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                "error", "Failed to save game",
                "message", e.getMessage()
            ));
        }
    }

    /**
     * GET /api/games/{gameId}
     * Get detailed information about a specific game
     */
    @GetMapping("/{gameId}")
    public ResponseEntity<?> getGameDetail(@PathVariable Long gameId, HttpServletRequest req) {
        System.out.println("📖 GET /api/games/{gameId} - Getting game: " + gameId);
        
        Long userId = getUserIdFromRequest(req);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of(
                "error", "Unauthorized"
            ));
        }

        try {
            GameDetailDto gameDetail = gameService.getGameDetail(gameId);
            return ResponseEntity.ok(gameDetail);
            
        } catch (Exception e) {
            System.out.println("❌ Error getting game: " + e.getMessage());
            return ResponseEntity.status(404).body(Map.of(
                "error", "Game not found"
            ));
        }
    }

    /**
     * GET /api/games/{gameId}/analysis
     * Get analysis for a specific game
     */
    @GetMapping("/{gameId}/analysis")
    public ResponseEntity<?> getGameAnalysis(@PathVariable Long gameId, HttpServletRequest req) {
        System.out.println("🔍 GET /api/games/{gameId}/analysis - Getting analysis: " + gameId);
        
        Long userId = getUserIdFromRequest(req);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of(
                "error", "Unauthorized"
            ));
        }

        try {
            GameAnalysisDto analysis = gameService.getGameAnalysis(gameId);
            return ResponseEntity.ok(analysis);
            
        } catch (Exception e) {
            System.out.println("⚠️ Analysis not available: " + e.getMessage());
            return ResponseEntity.status(404).body(Map.of(
                "error", "Analysis not found or still being processed"
            ));
        }
    }

    /**
     * GET /api/games/user/all
     * Get all games for the logged-in user
     */
    @GetMapping("/user/all")
    public ResponseEntity<?> getUserAllGames(HttpServletRequest req) {
        System.out.println("📚 GET /api/games/user/all - Getting all user games");
        
        Long userId = getUserIdFromRequest(req);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of(
                "error", "Unauthorized"
            ));
        }

        try {
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
            
            List<Game> games = gameService.getUserGames(user);
            
            List<RecentGameDto> gameDtos = games.stream()
                .map(game -> new RecentGameDto(
                    game.getId(),
                    game.getOpponentName(),
                    game.getResult(),
                    game.getRatingChange(),
                    game.getAccuracyPercentage(),
                    GameService.getTimeAgo(game.getPlayedAt())
                ))
                .toList();
            
            return ResponseEntity.ok(Map.of(
                "games", gameDtos,
                "total", gameDtos.size()
            ));
            
        } catch (Exception e) {
            System.out.println("❌ Error getting games: " + e.getMessage());
            return ResponseEntity.status(500).body(Map.of(
                "error", "Failed to load games"
            ));
        }
    }

    /**
     * GET /api/games/user/recent/{limit}
     * Get recent games for the logged-in user
     */
    @GetMapping("/user/recent/{limit}")
    public ResponseEntity<?> getUserRecentGames(@PathVariable int limit, HttpServletRequest req) {
        System.out.println("⏱️ GET /api/games/user/recent/{limit} - Getting recent games");
        
        Long userId = getUserIdFromRequest(req);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of(
                "error", "Unauthorized"
            ));
        }

        try {
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
            
            List<Game> games = gameService.getRecentGames(user, limit);
            
            List<RecentGameDto> gameDtos = games.stream()
                .map(game -> new RecentGameDto(
                    game.getId(),
                    game.getOpponentName(),
                    game.getResult(),
                    game.getRatingChange(),
                    game.getAccuracyPercentage(),
                    GameService.getTimeAgo(game.getPlayedAt())
                ))
                .toList();
            
            return ResponseEntity.ok(Map.of(
                "games", gameDtos,
                "total", gameDtos.size()
            ));
            
        } catch (Exception e) {
            System.out.println("❌ Error getting recent games: " + e.getMessage());
            return ResponseEntity.status(500).body(Map.of(
                "error", "Failed to load games"
            ));
        }
    }

    /**
     * Calculate rating change based on game result
     * Simplified calculation - can be enhanced with ELO formula
     */
    private Integer calculateRatingChange(SaveGameRequest request) {
        if ("WIN".equalsIgnoreCase(request.result())) {
            return 16; // Standard win rating gain
        } else if ("LOSS".equalsIgnoreCase(request.result())) {
            return -16; // Standard loss rating loss
        } else {
            return 0; // Draw
        }
    }
}
