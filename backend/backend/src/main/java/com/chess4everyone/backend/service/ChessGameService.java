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
     * Minimum number of half-moves (plies) a game must have to be considered
     * suitable for ML analysis. 20 half-moves = 10 full moves each side,
     * which gives enough data for opening/middlegame/endgame feature extraction.
     */
    private static final int MIN_PLIES_FOR_ML = 20;

    /**
     * Minimum PGN length in characters. A game with 10 moves will have at least
     * "1. e4 e5 2. ..." which is well above 100 chars.
     */
    private static final int MIN_PGN_LENGTH = 100;

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Get recent ML-worthy games (long enough to produce meaningful features).
     * Only returns games that pass the quality filter.
     *
     * @param user  The user whose games to fetch
     * @param count Maximum number of qualifying games to return
     * @return List of games formatted for ML API (may be shorter than {@code count})
     */
    public List<MLGameData> getRecentGamesForML(User user, int count) {
        log.info("Fetching up to {} ML-worthy games for user: {}", count, user.getId());

        List<Game> allGames = gameRepository.findByUserOrderByPlayedAtDesc(user);

        log.info("Found {} total games for user {}", allGames.size(), user.getId());

        List<MLGameData> mlGames = allGames.stream()
                .filter(g -> isMLWorthy(g))
                .limit(count)
                .map(g -> new MLGameData(g.getPgn()))
                .collect(Collectors.toList());

        log.info("Returning {} ML-worthy games out of {} total for user {}",
                mlGames.size(), allGames.size(), user.getId());

        return mlGames;
    }

    /**
     * Count games that qualify for ML analysis.
     * Used by the profile endpoint to tell the user how many more games they need.
     *
     * @param user The user to check
     * @return Number of ML-worthy games
     */
    public long countMLWorthyGames(User user) {
        List<Game> allGames = gameRepository.findByUserOrderByPlayedAtDesc(user);
        long worthy = allGames.stream().filter(this::isMLWorthy).count();
        long total  = allGames.size();

        // Log games that were filtered out (up to 5 to avoid log spam)
        allGames.stream()
                .filter(g -> !isMLWorthy(g))
                .limit(5)
                .forEach(g -> log.debug(
                        "Filtered out game id={} result={} opponent={} plies={} pgnLen={}",
                        g.getId(), g.getResult(), g.getOpponentName(),
                        countPlies(g.getPgn()), g.getPgn() != null ? g.getPgn().length() : 0));

        log.info("User {} has {}/{} ML-worthy games", user.getId(), worthy, total);
        return worthy;
    }

    /**
     * Legacy: count games with *any* PGN data (used by non-ML endpoints).
     */
    public long countGamesWithPGN(User user) {
        List<Game> allGames = gameRepository.findByUserOrderByPlayedAtDesc(user);
        long withPgn = allGames.stream()
                .filter(g -> g.getPgn() != null && !g.getPgn().trim().isEmpty())
                .count();
        log.info("User {} has {}/{} games with any PGN", user.getId(), withPgn, allGames.size());
        return withPgn;
    }

    /**
     * Get raw PGN strings for games (non-ML, no quality filter).
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
     * Get all games for a user (no filter).
     */
    public List<Game> getAllUserGames(User user) {
        return gameRepository.findByUserOrderByPlayedAtDesc(user);
    }

    // ─── Quality filter ───────────────────────────────────────────────────────

    /**
     * Determines whether a game is suitable for ML analysis.
     *
     * A game qualifies when ALL of the following hold:
     *  1. PGN is non-null and non-blank
     *  2. PGN is long enough to contain real moves (>= MIN_PGN_LENGTH chars)
     *  3. The game contains at least MIN_PLIES_FOR_ML half-moves
     *
     * This filters out:
     *  - Resigned/disconnected games with only 1-3 moves
     *  - Games saved with empty/placeholder PGN
     *  - Ultra-short bullet games that ended immediately
     */
    private boolean isMLWorthy(Game game) {
        String pgn = game.getPgn();

        // 1. Must have PGN
        if (pgn == null || pgn.trim().isEmpty()) {
            log.debug("Game {} filtered: null/empty PGN", game.getId());
            return false;
        }

        // 2. Minimum PGN length
        if (pgn.length() < MIN_PGN_LENGTH) {
            log.debug("Game {} filtered: PGN too short ({} chars)", game.getId(), pgn.length());
            return false;
        }

        // 3. Count actual half-moves
        int plies = countPlies(pgn);
        if (plies < MIN_PLIES_FOR_ML) {
            log.debug("Game {} filtered: only {} plies (need {})", game.getId(), plies, MIN_PLIES_FOR_ML);
            return false;
        }

        log.debug("Game {} accepted: {} plies, {} PGN chars", game.getId(), plies, pgn.length());
        return true;
    }

    /**
     * Count half-moves (plies) in a PGN string.
     *
     * Strategy: match move-number tokens ("1.", "2.", "1...", etc.) to count
     * move pairs, then look for a trailing black move on the last pair.
     * This is fast and does not require parsing the full PGN tree.
     */
    private int countPlies(String pgn) {
        if (pgn == null || pgn.isEmpty()) return 0;

        // Strip PGN headers (lines starting with '[')
        String movesOnly = pgn.replaceAll("(?m)^\\[.*?\\]\\s*", "")
                              .replaceAll("\\{[^}]*\\}", "")   // remove comments
                              .replaceAll("\\([^)]*\\)", "")   // remove variations
                              .trim();

        // Tokenise
        String[] tokens = movesOnly.split("\\s+");

        int plies = 0;
        for (String token : tokens) {
            if (token.isEmpty()) continue;
            // Skip move numbers (e.g. "1.", "12.", "3...")
            if (token.matches("\\d+\\.+")) continue;
            // Skip result markers
            if (token.matches("1-0|0-1|1/2-1/2|\\*")) continue;
            // Anything else that looks like a chess move counts as a ply
            if (token.matches("[a-hNBRQKO][a-hNBRQK1-8x=+#!?\\-O]*")) {
                plies++;
            }
        }

        return plies;
    }
}