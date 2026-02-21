package com.chess4everyone.backend.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.stereotype.Service;

import com.chess4everyone.backend.dto.GameAnalysisDto;
import com.chess4everyone.backend.dto.GameDetailDto;
import com.chess4everyone.backend.dto.SaveGameRequest;
import com.chess4everyone.backend.entity.Game;
import com.chess4everyone.backend.entity.GameAnalysis;
import com.chess4everyone.backend.entity.MultiplayerGame;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.entity.UserProfile;
import com.chess4everyone.backend.repo.UserRepository;
import com.chess4everyone.backend.repository.GameAnalysisRepository;
import com.chess4everyone.backend.repository.GameRepository;
import com.chess4everyone.backend.repository.MultiplayerGameRepository;
import com.chess4everyone.backend.repository.UserProfileRepository;

@Service
public class GameService {

    private final GameRepository gameRepository;
    private final GameAnalysisRepository analysisRepository;
    private final UserRepository userRepository;
    private final UserProfileRepository profileRepository;
    private final StockfishAnalysisService stockfishService;
    private final MultiplayerGameRepository multiplayerGameRepository;
        // simple in-memory locks to avoid concurrent double-export for same multiplayer game
        private static final java.util.concurrent.ConcurrentHashMap<String, Object> gameExportLocks =
            new java.util.concurrent.ConcurrentHashMap<>();

    public GameService(GameRepository gameRepository,
                      GameAnalysisRepository analysisRepository,
                      UserRepository userRepository,
                      UserProfileRepository profileRepository,
                      StockfishAnalysisService stockfishService,
                      MultiplayerGameRepository multiplayerGameRepository) {
        this.gameRepository = gameRepository;
        this.analysisRepository = analysisRepository;
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
        this.stockfishService = stockfishService;
        this.multiplayerGameRepository = multiplayerGameRepository;
    }

    /**
     * Save a completed game to the database
     */
    public Game saveGame(User user, SaveGameRequest request, Integer ratingChange) {
        System.out.println("💾 Saving game for user: " + user.getEmail());
        // If frontend supplied a multiplayer game UUID, try to locate the multiplayer game
        MultiplayerGame mpGame = null;
        if (request.gameUuid() != null) {
            try {
                var opt = multiplayerGameRepository.findByGameUuid(request.gameUuid());
                if (opt.isPresent()) {
                    mpGame = opt.get();
                    // If multiplayer game already linked to a saved games row, return it
                    if (mpGame.getSavedGameId() != null) {
                        Long savedId = mpGame.getSavedGameId();
                        System.out.println("⚠️ Multiplayer game already exported to games.id=" + savedId + ", returning existing record");
                        return gameRepository.findById(savedId).orElse(null);
                    }
                }
            } catch (Exception e) {
                System.out.println("⚠️ Error checking multiplayer game: " + e.getMessage());
            }
        }

        // Deduplication: check recent games for identical PGN or moves JSON
        try {
            List<Game> recent = gameRepository.findTop5ByUserOrderByPlayedAtDesc(user);
            for (Game g : recent) {
                if (g.getPgn() != null && request.pgn() != null && g.getPgn().equals(request.pgn())) {
                    System.out.println("⚠️ Duplicate game detected by PGN — returning existing record: " + g.getId());
                    return g; // return existing to avoid duplicate entries
                }
                if (g.getMovesJson() != null && request.movesJson() != null && g.getMovesJson().equals(request.movesJson())) {
                    System.out.println("⚠️ Duplicate game detected by movesJson — returning existing record: " + g.getId());
                    return g;
                }
            }
        } catch (Exception e) {
            System.out.println("⚠️ Error during duplicate check: " + e.getMessage());
        }

        Game game = new Game();
        game.setUser(user);
        game.setWhitePlayer(request.whitePlayerId() != null ? userRepository.findById(request.whitePlayerId()).orElse(null) : null);
        game.setBlackPlayer(request.blackPlayerId() != null ? userRepository.findById(request.blackPlayerId()).orElse(null) : null);
        game.setOpponentName(request.opponentName());
        game.setResult(request.result());
        game.setPgn(request.pgn());
        game.setMovesJson(request.movesJson());
        game.setWhiteRating(request.whiteRating());
        game.setBlackRating(request.blackRating());
        game.setTimeControl(request.timeControl());
        game.setOpeningName(request.openingName());
        game.setGameType(request.gameType());
        game.setTerminationReason(request.terminationReason());
        game.setMoveCount(request.moveCount());
        game.setTotalTimeWhiteMs(request.totalTimeWhiteMs());
        game.setTotalTimeBlackMs(request.totalTimeBlackMs());
        game.setAccuracyPercentage(request.accuracyPercentage());
        game.setRatingChange(ratingChange);
        game.setGameDuration(request.timeControl());
        game.setTimeAgo("just now");
        
        // If this is a multiplayer save, synchronize per-gameUuid to avoid concurrent duplicate exports
        Game savedGame;
        if (mpGame != null && request.gameUuid() != null) {
            Object lock = gameExportLocks.computeIfAbsent(request.gameUuid(), k -> new Object());
            synchronized (lock) {
                // re-fetch to see if another thread saved it while we waited
                var fresh = multiplayerGameRepository.findByGameUuid(request.gameUuid());
                if (fresh.isPresent() && fresh.get().getSavedGameId() != null) {
                    Long existingId = fresh.get().getSavedGameId();
                    System.out.println("⚠️ Multiplayer game already exported (race) to games.id=" + existingId + ", returning existing record");
                    gameExportLocks.remove(request.gameUuid());
                    return gameRepository.findById(existingId).orElse(null);
                }
                savedGame = gameRepository.save(game);
                System.out.println("✅ Game saved with ID: " + savedGame.getId());
                try {
                    mpGame.setSaved(true);
                    mpGame.setSavedGameId(savedGame.getId());
                    multiplayerGameRepository.save(mpGame);
                    System.out.println("✅ Marked multiplayer_game " + mpGame.getId() + " as saved -> games.id=" + savedGame.getId());
                } catch (Exception e) {
                    System.out.println("⚠️ Failed to mark multiplayer game as saved: " + e.getMessage());
                }
                gameExportLocks.remove(request.gameUuid());
            }
        } else {
            savedGame = gameRepository.save(game);
            System.out.println("✅ Game saved with ID: " + savedGame.getId());
        }
        
        // Update user profile stats
        updateUserProfile(user, request.result());
        
        // Trigger async analysis
        analyzeGameAsync(savedGame);
        
        // If this save corresponds to a multiplayer game, mark it as exported
        if (mpGame != null) {
            try {
                mpGame.setSaved(true);
                mpGame.setSavedGameId(savedGame.getId());
                multiplayerGameRepository.save(mpGame);
                System.out.println("✅ Marked multiplayer_game " + mpGame.getId() + " as saved -> games.id=" + savedGame.getId());
            } catch (Exception e) {
                System.out.println("⚠️ Failed to mark multiplayer game as saved: " + e.getMessage());
            }
        }
        return savedGame;
    }

    /**
     * Get detailed game information
     */
    public GameDetailDto getGameDetail(Long gameId) {
        Game game = gameRepository.findById(gameId)
            .orElseThrow(() -> new RuntimeException("Game not found"));
        
        return new GameDetailDto(
            game.getId(),
            game.getOpponentName(),
            game.getResult(),
            game.getGameType(),
            game.getTimeControl(),
            game.getPgn(),
            game.getMovesJson(),
            game.getMoveCount(),
            game.getTotalTimeWhiteMs(),
            game.getTotalTimeBlackMs(),
            game.getWhiteRating(),
            game.getBlackRating(),
            game.getRatingChange(),
            game.getAccuracyPercentage(),
            game.getTerminationReason(),
            game.getPlayedAt().toString(),
            game.getWhitePlayer() != null ? game.getWhitePlayer().getId() : null,
            game.getBlackPlayer() != null ? game.getBlackPlayer().getId() : null,
            game.getOpeningName()
        );
    }

    /**
     * Get all games for a user
     */
    public List<Game> getUserGames(User user) {
        return gameRepository.findByUserOrderByPlayedAtDesc(user);
    }

    /**
     * Get recent games for a user
     */
    public List<Game> getRecentGames(User user, int limit) {
        return gameRepository.findByUserOrderByPlayedAtDesc(user).stream()
            .limit(limit)
            .toList();
    }

    /**
     * Get analysis for a game
     * Returns null if analysis is not available (still being processed)
     */
    public GameAnalysisDto getGameAnalysis(Long gameId) {
        try {
            GameAnalysis analysis = analysisRepository.findByGameId(gameId)
                .orElseThrow(() -> new RuntimeException("Analysis not found for game: " + gameId));
            
            return new GameAnalysisDto(
                analysis.getGame().getId(),
                analysis.getWhiteAccuracy(),
                analysis.getBlackAccuracy(),
                analysis.getWhiteBlunders(),
                analysis.getBlackBlunders(),
                analysis.getWhiteMistakes(),
                analysis.getBlackMistakes(),
                analysis.getMovesAnalysis(),
                analysis.getBestMovesByPhase(),
                analysis.getKeyMoments(),
                analysis.getOpeningName(),
                analysis.getOpeningPly(),
                analysis.getOpeningScoreWhite(),
                analysis.getOpeningScoreBlack(),
                analysis.getMiddlegameScoreWhite(),
                analysis.getMiddlegameScoreBlack(),
                analysis.getEndgameScoreWhite(),
                analysis.getEndgameScoreBlack()
            );
        } catch (RuntimeException e) {
            System.out.println("⚠️ Analysis not yet available for game " + gameId + ": " + e.getMessage());
            throw e; // Let controller handle the error response
        }
    }

    /**
     * Analyze game asynchronously with Stockfish
     */
    private void analyzeGameAsync(Game game) {
        // Run in a separate thread to not block the game save
        new Thread(() -> {
            try {
                System.out.println("🔍 Starting async analysis thread for game: " + game.getId());
                System.out.println("   Game ID: " + game.getId());
                System.out.println("   PGN present: " + (game.getPgn() != null && !game.getPgn().isEmpty()));
                System.out.println("   Calling stockfishService.analyzeGame()...");
                stockfishService.analyzeGame(game);
                System.out.println("✅ Analysis completed for game: " + game.getId());
            } catch (Exception e) {
                System.err.println("❌ Failed to analyze game: " + e.getMessage());
                e.printStackTrace();
            }
        }).start();
    }

    /**
     * Update user profile with game result
     */
    private void updateUserProfile(User user, String result) {
        UserProfile profile = profileRepository.findByUserId(user.getId())
            .orElse(new UserProfile());
        
        if (profile.getUser() == null) {
            profile.setUser(user);
        }
        
        // Update games played
        profile.setGamesPlayed(profile.getGamesPlayed() + 1);
        
        // Update wins/losses/draws
        switch (result.toUpperCase()) {
            case "WIN":
                profile.setWins(profile.getWins() + 1);
                break;
            case "LOSS":
                profile.setLosses(profile.getLosses() + 1);
                break;
            case "DRAW":
                profile.setDraws(profile.getDraws() + 1);
                break;
        }
        
        // Update win rate
        int totalGames = profile.getWins() + profile.getLosses() + profile.getDraws();
        double winRate = totalGames > 0 ? (profile.getWins() * 100.0) / totalGames : 0.0;
        profile.setWinRate(winRate);
        
        profileRepository.save(profile);
        System.out.println("📊 Updated profile for user: " + user.getEmail());
    }

    /**
     * Format time ago string
     */
    public static String getTimeAgo(Instant instant) {
        Instant now = Instant.now();
        long secondsAgo = ChronoUnit.SECONDS.between(instant, now);
        
        if (secondsAgo < 60) {
            return "just now";
        } else if (secondsAgo < 3600) {
            long minutesAgo = secondsAgo / 60;
            return minutesAgo + (minutesAgo == 1 ? " minute" : " minutes") + " ago";
        } else if (secondsAgo < 86400) {
            long hoursAgo = secondsAgo / 3600;
            return hoursAgo + (hoursAgo == 1 ? " hour" : " hours") + " ago";
        } else if (secondsAgo < 2592000) {
            long daysAgo = secondsAgo / 86400;
            return daysAgo + (daysAgo == 1 ? " day" : " days") + " ago";
        } else {
            long monthsAgo = secondsAgo / 2592000;
            return monthsAgo + (monthsAgo == 1 ? " month" : " months") + " ago";
        }
    }
}
