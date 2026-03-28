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

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class GameService {

    private final GameRepository gameRepository;
    private final GameAnalysisRepository analysisRepository;
    private final UserRepository userRepository;
    private final UserProfileRepository profileRepository;
    private final StockfishAnalysisService stockfishService;
    private final MultiplayerGameRepository multiplayerGameRepository;
    private final RatingService ratingService;

    private static final java.util.concurrent.ConcurrentHashMap<String, Object> gameExportLocks =
            new java.util.concurrent.ConcurrentHashMap<>();

    public GameService(GameRepository gameRepository,
                       GameAnalysisRepository analysisRepository,
                       UserRepository userRepository,
                       UserProfileRepository profileRepository,
                       StockfishAnalysisService stockfishService,
                       MultiplayerGameRepository multiplayerGameRepository,
                       RatingService ratingService) {
        this.gameRepository = gameRepository;
        this.analysisRepository = analysisRepository;
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
        this.stockfishService = stockfishService;
        this.multiplayerGameRepository = multiplayerGameRepository;
        this.ratingService = ratingService;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Save a completed game to the `games` table.
     *
     * For multiplayer games each player gets their own row. Deduplication is
     * done with a per-player in-memory lock (uuid#userId) combined with a DB
     * check so that even if the WebSocket fires the save multiple times the
     * row is only written once.
     */
    public Game saveGame(User user, SaveGameRequest request, Integer ratingChange) {
        log.info("saveGame called for user={} | result={} | uuid={}",
                user.getEmail(), request.result(), request.gameUuid());

        String rawUuid       = request.gameUuid();
        String canonicalUuid = (rawUuid != null && rawUuid.endsWith("-black"))
                ? rawUuid.substring(0, rawUuid.length() - 6)
                : rawUuid;

        String lockKey = (canonicalUuid != null)
                ? canonicalUuid + "#" + user.getId()
                : null;

        if (lockKey != null) {
            Object lock = gameExportLocks.computeIfAbsent(lockKey, k -> new Object());
            synchronized (lock) {
                var mpOpt = multiplayerGameRepository.findByGameUuid(canonicalUuid);
                if (mpOpt.isPresent()) {
                    MultiplayerGame mp = mpOpt.get();
                    boolean isWhite = user.getId().equals(mp.getWhitePlayer().getId());

                    if (isWhite && mp.getSavedGameId() != null) {
                        log.warn("White already saved -> games.id={}", mp.getSavedGameId());
                        return gameRepository.findById(mp.getSavedGameId()).orElse(null);
                    }

                    if (!isWhite) {
                        List<Game> recent = gameRepository.findTop5ByUserOrderByPlayedAtDesc(user);
                        for (Game g : recent) {
                            if (request.pgn() != null
                                    && request.pgn().equals(g.getPgn())
                                    && user.getId().equals(g.getUser().getId())) {
                                log.warn("Black already saved -> games.id={}", g.getId());
                                return g;
                            }
                        }
                    }
                }
                return buildAndSaveGame(user, request, ratingChange, canonicalUuid);
            }
        }

        return buildAndSaveGameSolo(user, request, ratingChange);
    }

    // ── Internal save helpers ─────────────────────────────────────────────────

    private Game buildAndSaveGame(User user, SaveGameRequest request,
                                   Integer ratingChange, String canonicalUuid) {

        Game game = buildGameEntity(user, request, ratingChange);
        Game savedGame = gameRepository.save(game);

        log.info("Game saved -> id={} user={} result={}",
                savedGame.getId(), user.getEmail(), request.result());

        if (canonicalUuid != null) {
            try {
                multiplayerGameRepository.findByGameUuid(canonicalUuid).ifPresent(mp -> {
                    boolean isWhite = user.getId().equals(mp.getWhitePlayer().getId());
                    if (isWhite && mp.getSavedGameId() == null) {
                        mp.setSaved(true);
                        mp.setSavedGameId(savedGame.getId());
                        multiplayerGameRepository.save(mp);
                    }
                });
            } catch (Exception e) {
                log.warn("Could not mark mp game saved: {}", e.getMessage());
            }
        }

        triggerRatingUpdate(user, savedGame, request);
        updateUserProfile(user, request.result());
        analyzeGameAsync(savedGame);
        return savedGame;
    }

    private Game buildAndSaveGameSolo(User user, SaveGameRequest request, Integer ratingChange) {
        try {
            List<Game> recent = gameRepository.findTop5ByUserOrderByPlayedAtDesc(user);
            for (Game g : recent) {
                if (g.getPgn() != null && request.pgn() != null && g.getPgn().equals(request.pgn())) {
                    log.warn("Duplicate by PGN -> {}", g.getId());
                    return g;
                }
                if (g.getMovesJson() != null && request.movesJson() != null
                        && g.getMovesJson().equals(request.movesJson())) {
                    log.warn("Duplicate by movesJson -> {}", g.getId());
                    return g;
                }
            }
        } catch (Exception e) {
            log.warn("Error during duplicate check: {}", e.getMessage());
        }

        Game game = buildGameEntity(user, request, ratingChange);
        Game savedGame = gameRepository.save(game);
        log.info("Solo game saved -> id={} user={} result={}",
                savedGame.getId(), user.getEmail(), request.result());

        triggerRatingUpdate(user, savedGame, request);
        updateUserProfile(user, request.result());
        analyzeGameAsync(savedGame);
        return savedGame;
    }

    private Game buildGameEntity(User user, SaveGameRequest request, Integer ratingChange) {
        Game game = new Game();
        game.setUser(user);
        game.setWhitePlayer(request.whitePlayerId() != null
                ? userRepository.findById(request.whitePlayerId()).orElse(null) : null);
        game.setBlackPlayer(request.blackPlayerId() != null
                ? userRepository.findById(request.blackPlayerId()).orElse(null) : null);
        game.setOpponentName(request.opponentName());
        game.setResult(request.result());
        game.setPgn(request.pgn());
        game.setMovesJson(request.movesJson());
        game.setWhiteRating(request.whiteRating()  != null ? request.whiteRating()  : 1200);
        game.setBlackRating(request.blackRating()  != null ? request.blackRating()  : 1200);
        game.setTimeControl(request.timeControl());
        game.setOpeningName(request.openingName());
        game.setGameType(request.gameType());
        game.setTerminationReason(request.terminationReason());
        game.setMoveCount(request.moveCount()       != null ? request.moveCount()       : 0);
        game.setTotalTimeWhiteMs(request.totalTimeWhiteMs() != null ? request.totalTimeWhiteMs() : 0L);
        game.setTotalTimeBlackMs(request.totalTimeBlackMs() != null ? request.totalTimeBlackMs() : 0L);
        game.setAccuracyPercentage(request.accuracyPercentage());
        game.setRatingChange(ratingChange);
        game.setGameDuration(request.timeControl());
        game.setTimeAgo("just now");
        return game;
    }

    // ── Rating update ─────────────────────────────────────────────────────────

    /**
     * Resolve both players and call the appropriate RatingService method.
     *
     * FIXED:
     * - Solo AI games now call updateSoloRating() instead of updateRatings(user, user, ...)
     *   which previously resulted in a player rated against themselves (no change).
     * - Multiplayer games correctly determine white's result before calling updateRatings().
     * - All DB work inside RatingService uses TransactionTemplate (thread-safe).
     */
    private void triggerRatingUpdate(User user, Game savedGame, SaveGameRequest request) {
        new Thread(() -> {
            try {
                Long whiteId = request.whitePlayerId();
                Long blackId = request.blackPlayerId();

                // ── Solo AI game ──────────────────────────────────────────────
                if (whiteId == null || blackId == null) {
                    log.info("Solo game rating update for user={} result={}",
                            user.getEmail(), request.result());
                    ratingService.updateSoloRating(user, request.result(), savedGame);
                    return;
                }

                // ── Multiplayer game ──────────────────────────────────────────
                userRepository.findById(whiteId).ifPresent(white ->
                    userRepository.findById(blackId).ifPresent(black -> {

                        // request.result() is always from the perspective of `user`.
                        // We need whiteResult for RatingService.updateRatings().
                        String whiteResult;
                        if (white.getId().equals(user.getId())) {
                            // user IS white — result is already from white's perspective
                            whiteResult = request.result();
                        } else {
                            // user IS black — flip the result to get white's perspective
                            whiteResult = switch (request.result().toUpperCase()) {
                                case "WIN"  -> "LOSS";
                                case "LOSS" -> "WIN";
                                default     -> "DRAW";
                            };
                        }

                        log.info("Multiplayer rating update: white={} ({}) vs black={}",
                                white.getName(), whiteResult, black.getName());

                        ratingService.updateRatings(white, black, whiteResult, savedGame);
                    }));

            } catch (Exception e) {
                log.error("Rating update failed for game {}: {}", savedGame.getId(), e.getMessage(), e);
            }
        }, "rating-update-" + savedGame.getId()).start();
    }

    // ── Read methods ──────────────────────────────────────────────────────────

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

    public List<Game> getUserGames(User user) {
        return gameRepository.findByUserOrderByPlayedAtDesc(user);
    }

    public List<Game> getRecentGames(User user, int limit) {
        return gameRepository.findByUserOrderByPlayedAtDesc(user).stream()
                .limit(limit)
                .toList();
    }

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
            log.warn("Analysis not yet available for game {}: {}", gameId, e.getMessage());
            throw e;
        }
    }

    // ── Profile update ────────────────────────────────────────────────────────

    private void updateUserProfile(User user, String result) {
        UserProfile profile = profileRepository.findByUserId(user.getId())
                .orElse(new UserProfile());

        if (profile.getUser() == null) profile.setUser(user);

        profile.setGamesPlayed(profile.getGamesPlayed() + 1);

        switch (result.toUpperCase()) {
            case "WIN"  -> profile.setWins(profile.getWins()     + 1);
            case "LOSS" -> profile.setLosses(profile.getLosses() + 1);
            case "DRAW" -> profile.setDraws(profile.getDraws()   + 1);
        }

        int total = profile.getWins() + profile.getLosses() + profile.getDraws();
        profile.setWinRate(total > 0 ? (profile.getWins() * 100.0) / total : 0.0);

        profileRepository.save(profile);
        log.info("Profile updated for: {}", user.getEmail());
    }

    // ── Async analysis ────────────────────────────────────────────────────────

    private void analyzeGameAsync(Game game) {
        new Thread(() -> {
            try {
                log.info("Async analysis started for game: {}", game.getId());
                stockfishService.analyzeGame(game);
                log.info("Analysis complete for game: {}", game.getId());
            } catch (Exception e) {
                log.error("Failed to analyze game {}: {}", game.getId(), e.getMessage());
            }
        }, "analysis-" + game.getId()).start();
    }

    // ── Utility ───────────────────────────────────────────────────────────────

    public static String getTimeAgo(Instant instant) {
        long s = ChronoUnit.SECONDS.between(instant, Instant.now());
        if (s < 60)      return "just now";
        if (s < 3600)    { long m = s / 60;        return m + (m == 1 ? " minute" : " minutes") + " ago"; }
        if (s < 86400)   { long h = s / 3600;      return h + (h == 1 ? " hour"   : " hours")   + " ago"; }
        if (s < 2592000) { long d = s / 86400;     return d + (d == 1 ? " day"    : " days")     + " ago"; }
        long mo = s / 2592000; return mo + (mo == 1 ? " month" : " months") + " ago";
    }
}