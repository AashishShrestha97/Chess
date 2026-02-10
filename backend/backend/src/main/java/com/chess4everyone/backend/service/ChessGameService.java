package com.chess4everyone.backend.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.chess4everyone.backend.dto.MLGameData;
import com.chess4everyone.backend.entity.Game;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.repository.GameRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Service for fetching chess games in formats suitable for analysis
 * Handles conversion from database Game entities to various formats
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChessGameService {
    
    private final GameRepository gameRepository;
    
    /**
     * Get recent games in ML API format (PGN wrapped in MLGameData)
     * @param user The user whose games to fetch
     * @param count Number of recent games to fetch
     * @return List of games formatted for ML API
     */
    public List<MLGameData> getRecentGamesForML(User user, int count) {
        log.info("Fetching {} recent games for ML analysis for user: {}", count, user.getId());
        
        List<Game> games = gameRepository.findByUserOrderByPlayedAtDesc(user)
            .stream()
            .limit(count)
            .collect(Collectors.toList());
        
        log.info("Found {} total recent games", games.size());
        
        if (games.isEmpty()) {
            log.warn("No games found for user: {}", user.getId());
            return List.of();
        }
        
        // Log first few games for debugging
        for (int i = 0; i < Math.min(3, games.size()); i++) {
            Game g = games.get(i);
            String pgn = g.getPgn();
            int moveCount = pgn != null ? pgn.split("\\d+\\.").length - 1 : 0;
            log.debug("  Game {}: PGN length={}, moves~{}, isNull={}, isEmpty={}", 
                i+1, 
                pgn != null ? pgn.length() : "null",
                moveCount,
                pgn == null,
                pgn != null && pgn.trim().isEmpty()
            );
            if (pgn != null && pgn.length() < 150) {
                log.debug("    Content: {}", pgn);
            }
        }
        
        List<MLGameData> mlGames = games.stream()
            .filter(g -> {
                if (g.getPgn() == null) {
                    System.out.println("⚠️ Filtering out game ID " + g.getId() + ": PGN is null (result: " + g.getResult() + ", opponent: " + g.getOpponentName() + ")");
                    return false;
                }
                if (g.getPgn().trim().isEmpty()) {
                    System.out.println("⚠️ Filtering out game ID " + g.getId() + ": PGN is empty (result: " + g.getResult() + ", opponent: " + g.getOpponentName() + ")");
                    return false;
                }
                // Check for minimum PGN length - be lenient
                if (g.getPgn().length() < 50) {
                    System.out.println("⚠️ Filtering out game ID " + g.getId() + ": PGN too short (" + g.getPgn().length() + " bytes, result: " + g.getResult() + ", opponent: " + g.getOpponentName() + ")");
                    return false;
                }
                
                // Better move counting: look for actual chess moves (includes algebraic notation like e4, Nf3, etc)
                // This regex looks for move numbers followed by moves
                int moveCount = 0;
                java.util.regex.Pattern movePattern = java.util.regex.Pattern.compile("\\d+\\.\\s*([A-Za-z0-9\\-=+#]+)");
                java.util.regex.Matcher matcher = movePattern.matcher(g.getPgn());
                while (matcher.find()) {
                    moveCount++;
                }
                
                // Accept games with at least 1 move (was 2, now 1)
                if (moveCount < 1) {
                    System.out.println("⚠️ Filtering out game ID " + g.getId() + ": Too few moves (" + moveCount + ", result: " + g.getResult() + ", opponent: " + g.getOpponentName() + ", PGN: " + g.getPgn().substring(0, Math.min(100, g.getPgn().length())) + ")");
                    return false;
                }
                System.out.println("✅ Keeping game ID " + g.getId() + ": PGN length=" + g.getPgn().length() + " bytes, moves=" + moveCount);
                return true;
            })
            .map(g -> new MLGameData(g.getPgn()))
            .collect(Collectors.toList());
        
        System.out.println("📊 Converted " + mlGames.size() + " out of " + games.size() + " games to ML format for user " + user.getId());
        if (mlGames.size() < games.size()) {
            System.out.println("⚠️ " + (games.size() - mlGames.size()) + " games were filtered out (null/empty/incomplete PGN)");
        }
        return mlGames;
    }
    
    /**
     * Get raw PGN strings for games
     * @param user The user whose games to fetch
     * @param count Number of recent games to fetch
     * @return List of PGN strings
     */
    public List<String> getRecentGamesPGN(User user, int count) {
        return gameRepository.findByUserOrderByPlayedAtDesc(user)
            .stream()
            .limit(count)
            .map(Game::getPgn)
            .filter(pgn -> pgn != null && !pgn.trim().isEmpty())
            .collect(Collectors.toList());
    }
    
    /**
     * Get all games for a user
     * @param user The user whose games to fetch
     * @return All games for the user, ordered by most recent first
     */
    public List<Game> getAllUserGames(User user) {
        return gameRepository.findByUserOrderByPlayedAtDesc(user);
    }
    
    /**
     * Count games with valid PGN data for a user
     * @param user The user to check
     * @return Number of games with valid PGN
     */
    public long countGamesWithPGN(User user) {
        List<Game> allGames = gameRepository.findByUserOrderByPlayedAtDesc(user);
        long gamesWithPGN = allGames.stream()
            .filter(g -> g.getPgn() != null && !g.getPgn().trim().isEmpty())
            .count();
        
        // Log detailed info about games without PGN
        allGames.stream()
            .filter(g -> g.getPgn() == null || g.getPgn().trim().isEmpty())
            .forEach(g -> System.out.println("⚠️ Game ID " + g.getId() + " missing PGN (result: " + g.getResult() + ", opponent: " + g.getOpponentName() + ")"));
        
        System.out.println("📊 User " + user.getName() + " has " + allGames.size() + " total games, " + gamesWithPGN + " with valid PGN");
        
        return gamesWithPGN;
    }
}
