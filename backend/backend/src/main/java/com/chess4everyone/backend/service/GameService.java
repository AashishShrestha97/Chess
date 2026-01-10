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
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.entity.UserProfile;
import com.chess4everyone.backend.repo.UserRepository;
import com.chess4everyone.backend.repository.GameAnalysisRepository;
import com.chess4everyone.backend.repository.GameRepository;
import com.chess4everyone.backend.repository.UserProfileRepository;

@Service
public class GameService {

    private final GameRepository gameRepository;
    private final GameAnalysisRepository analysisRepository;
    private final UserRepository userRepository;
    private final UserProfileRepository profileRepository;
    private final StockfishAnalysisService stockfishService;

    public GameService(GameRepository gameRepository,
                      GameAnalysisRepository analysisRepository,
                      UserRepository userRepository,
                      UserProfileRepository profileRepository,
                      StockfishAnalysisService stockfishService) {
        this.gameRepository = gameRepository;
        this.analysisRepository = analysisRepository;
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
        this.stockfishService = stockfishService;
    }

    /**
     * Save a completed game to the database
     */
    public Game saveGame(User user, SaveGameRequest request, Integer ratingChange) {
        System.out.println("💾 Saving game for user: " + user.getEmail());
        
        Game game = new Game();
        game.setUser(user);
        game.setOpponentName(request.opponentName());
        game.setResult(request.result());
        game.setPgn(request.pgn());
        game.setMovesJson(request.movesJson());
        game.setWhiteRating(request.whiteRating());
        game.setBlackRating(request.blackRating());
        game.setTimeControl(request.timeControl());
        game.setGameType(request.gameType());
        game.setTerminationReason(request.terminationReason());
        game.setMoveCount(request.moveCount());
        game.setTotalTimeWhiteMs(request.totalTimeWhiteMs());
        game.setTotalTimeBlackMs(request.totalTimeBlackMs());
        game.setAccuracyPercentage(request.accuracyPercentage());
        game.setRatingChange(ratingChange);
        game.setGameDuration(request.timeControl());
        game.setTimeAgo("just now");
        
        Game savedGame = gameRepository.save(game);
        System.out.println("✅ Game saved with ID: " + savedGame.getId());
        
        // Update user profile stats
        updateUserProfile(user, request.result());
        
        // Trigger async analysis
        analyzeGameAsync(savedGame);
        
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
            game.getPlayedAt().toString()
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
     */
    public GameAnalysisDto getGameAnalysis(Long gameId) {
        GameAnalysis analysis = analysisRepository.findByGameId(gameId)
            .orElseThrow(() -> new RuntimeException("Analysis not found"));
        
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
    }

    /**
     * Analyze game asynchronously with Stockfish
     */
    private void analyzeGameAsync(Game game) {
        // Run in a separate thread to not block the game save
        new Thread(() -> {
            try {
                System.out.println("🔍 Starting analysis for game: " + game.getId());
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
