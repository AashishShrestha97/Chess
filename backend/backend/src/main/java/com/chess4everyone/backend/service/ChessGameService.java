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
                    log.warn("Filtering out game: PGN is null");
                    return false;
                }
                if (g.getPgn().trim().isEmpty()) {
                    log.warn("Filtering out game: PGN is empty");
                    return false;
                }
                // Check for minimum PGN length - be lenient
                if (g.getPgn().length() < 50) {
                    log.warn("Filtering out game: PGN too short ({} bytes)", g.getPgn().length());
                    return false;
                }
                // Count approximate moves - accept even incomplete games
                int moveCount = g.getPgn().split("\\d+\\.").length - 1;
                if (moveCount < 2) {
                    log.warn("Filtering out game: Too few moves ({}) - games need at least 2 moves", moveCount);
                    return false;
                }
                return true;
            })
            .map(g -> new MLGameData(g.getPgn()))
            .collect(Collectors.toList());
        
        log.info("Converted {} out of {} games to ML format", mlGames.size(), games.size());
        if (mlGames.size() < games.size()) {
            log.warn("⚠️ {} games were filtered out (null/empty/incomplete PGN)", 
                games.size() - mlGames.size());
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
        return gameRepository.findByUserOrderByPlayedAtDesc(user)
            .stream()
            .filter(g -> g.getPgn() != null && !g.getPgn().trim().isEmpty())
            .count();
    }
}
