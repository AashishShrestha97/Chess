package com.chess4everyone.backend.websocket;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

import com.chess4everyone.backend.dto.SaveGameRequest;
import com.chess4everyone.backend.entity.MultiplayerGame;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.repo.UserRepository;
import com.chess4everyone.backend.repository.MultiplayerGameRepository;
import com.chess4everyone.backend.security.JwtService;
import com.chess4everyone.backend.service.GameService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Handles in-game WebSocket connections for live multiplayer chess.
 *
 * Frontend URL: ws://localhost:8080/api/game/{gameId}?token=JWT
 *
 * On game end, automatically saves to the `games` table so that
 * game history, analysis, and profile stats all work correctly.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GameWebSocketHandler extends AbstractWebSocketHandler {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final MultiplayerGameRepository multiplayerGameRepository;
    private final ObjectMapper objectMapper;
    private final GameService gameService;

    // gameId → set of sessions in that game
    private final Map<Long, Set<WebSocketSession>> gameSessions = new ConcurrentHashMap<>();

    // sessionId → gameId
    private final Map<String, Long> sessionGame = new ConcurrentHashMap<>();

    // sessionId → User
    private final Map<String, User> sessionUsers = new ConcurrentHashMap<>();

    // sessionId → color ("white" or "black")
    private final Map<String, String> sessionColor = new ConcurrentHashMap<>();

    // gameId → accumulated PGN (SAN moves space-separated)
    private final Map<Long, StringBuilder> gamePgn = new ConcurrentHashMap<>();

    // gameId → move count
    private final Map<Long, Integer> gameMoveCount = new ConcurrentHashMap<>();

    // gameId → latest FEN
    private final Map<Long, String> gameLatestFen = new ConcurrentHashMap<>();

    // ── gameId-level lock to ensure endGameAndSave runs exactly once ──────────
    // We use a separate lock map here (not the per-player one in GameService)
    // to guard the "check saved flag → set saved flag → fire async save" triple
    // as a single atomic unit.
    private final Map<Long, Object> gameEndLocks = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sessionId = session.getId();
        String path  = session.getUri() != null ? session.getUri().getPath()  : "";
        String query = session.getUri() != null ? session.getUri().getQuery() : "";

        Long   gameId = extractGameId(path);
        String token  = extractParam(query, "token");

        if (gameId == null) {
            log.warn("❌ Cannot extract gameId from path: {}", path);
            session.close(CloseStatus.BAD_DATA.withReason("Invalid game path"));
            return;
        }
        if (token == null || token.isBlank()) {
            session.close(CloseStatus.BAD_DATA.withReason("Missing token"));
            return;
        }

        // Auth
        User user;
        try {
            String userId = jwtService.parseToken(token).getBody().getSubject();
            user = userRepository.findById(Long.valueOf(userId))
                    .orElseThrow(() -> new RuntimeException("User not found"));
        } catch (Exception e) {
            log.warn("❌ Invalid token for game session: {}", e.getMessage());
            session.close(CloseStatus.BAD_DATA.withReason("Invalid token"));
            return;
        }

        // Load game
        MultiplayerGame game = multiplayerGameRepository.findById(gameId).orElse(null);
        if (game == null) {
            log.warn("❌ Game {} not found", gameId);
            session.close(CloseStatus.BAD_DATA.withReason("Game not found"));
            return;
        }

        // Determine player color
        String color;
        if (game.getWhitePlayer().getId().equals(user.getId())) {
            color = "white";
        } else if (game.getBlackPlayer().getId().equals(user.getId())) {
            color = "black";
        } else {
            log.warn("❌ User {} is not a participant in game {}", user.getId(), gameId);
            session.close(CloseStatus.BAD_DATA.withReason("Not a participant"));
            return;
        }

        // Register
        sessionUsers.put(sessionId, user);
        sessionGame.put(sessionId, gameId);
        sessionColor.put(sessionId, color);
        gameSessions.computeIfAbsent(gameId, k -> ConcurrentHashMap.newKeySet()).add(session);
        gamePgn.putIfAbsent(gameId, new StringBuilder());
        gameMoveCount.putIfAbsent(gameId, 0);
        gameLatestFen.putIfAbsent(gameId,
                "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
        gameEndLocks.computeIfAbsent(gameId, k -> new Object());

        log.info("✅ Player {} connected to game {} as {}", user.getName(), gameId, color);

        Set<WebSocketSession> players = gameSessions.get(gameId);

        if (players.size() == 1) {
            send(session, Map.of(
                "type",    "WAITING_FOR_OPPONENT",
                "message", "Waiting for opponent to connect..."
            ));
        } else if (players.size() >= 2) {
            broadcastToGame(gameId, Map.of(
                "type",          "GAME_START",
                "gameId",        gameId,
                "whitePlayer",   game.getWhitePlayer().getName(),
                "blackPlayer",   game.getBlackPlayer().getName(),
                "whitePlayerId", game.getWhitePlayer().getId(),
                "blackPlayerId", game.getBlackPlayer().getId(),
                "timeControl",   game.getTimeControl() != null ? game.getTimeControl() : "10+0",
                "status",        "ACTIVE"
            ));

            game.setStatus("ACTIVE");
            game.setStartedAt(Instant.now());
            multiplayerGameRepository.save(game);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String sessionId = session.getId();
        Long   gameId    = sessionGame.get(sessionId);
        User   user      = sessionUsers.get(sessionId);
        String color     = sessionColor.get(sessionId);

        if (gameId == null || user == null) {
            log.warn("⚠️ Message from unregistered session {}", sessionId);
            return;
        }

        Map<String, Object> data;
        try {
            data = objectMapper.readValue(message.getPayload(), new TypeReference<>() {});
        } catch (Exception e) {
            log.error("❌ Invalid JSON from {}: {}", sessionId, e.getMessage());
            return;
        }

        String type = (String) data.get("type");
        if (type == null) return;

        log.debug("📨 [{}] {} from {} ({})", gameId, type, user.getName(), color);

        switch (type) {
            case "MOVE" -> {
                // Track move for PGN / FEN
                String san = (String) data.get("san");
                String fen = (String) data.get("fen");

                if (san != null && !san.isBlank()) {
                    StringBuilder pgn = gamePgn.computeIfAbsent(gameId, k -> new StringBuilder());
                    int moveNum = gameMoveCount.merge(gameId, 1, Integer::sum);
                    // Prepend move number for white moves
                    if (color.equals("white")) {
                        if (pgn.length() > 0) pgn.append(" ");
                        pgn.append(((moveNum + 1) / 2)).append(". ").append(san);
                    } else {
                        pgn.append(" ").append(san);
                    }
                }
                if (fen != null && !fen.isBlank()) {
                    gameLatestFen.put(gameId, fen);
                }

                // Also persist FEN to multiplayer_games for recovery
                if (fen != null) {
                    multiplayerGameRepository.findById(gameId).ifPresent(g -> {
                        g.setCurrentFen(fen);
                        g.setLastMoveAt(Instant.now());
                        if (san != null) {
                            String cur = g.getPgn() != null ? g.getPgn() : "";
                            g.setPgn(cur.isBlank() ? san : cur + " " + san);
                        }
                        multiplayerGameRepository.save(g);
                    });
                }

                data.put("player", color);
                sendToOpponent(gameId, sessionId, data);
            }

            case "OFFER_DRAW" -> broadcastToGame(gameId, Map.of(
                "type", "DRAW_OFFER",
                "from", color
            ));

            case "ACCEPT_DRAW" -> {
                endGameAndSave(gameId, null, "DRAW_AGREEMENT");
                broadcastToGame(gameId, Map.of(
                    "type",   "GAME_OVER",
                    "winner", "draw",
                    "reason", "Draw by agreement"
                ));
            }

            case "DECLINE_DRAW" -> broadcastToGame(gameId, Map.of(
                "type", "DRAW_DECLINED",
                "from", color
            ));

            case "RESIGN" -> {
                String winner = color.equals("white") ? "black" : "white";
                endGameAndSave(gameId, winner, "RESIGN");
                broadcastToGame(gameId, Map.of(
                    "type",   "GAME_OVER",
                    "winner", winner,
                    "reason", (color.equals("white") ? "White" : "Black") + " resigned"
                ));
            }

            case "FLAG" -> {
                String flaggedPlayer = (String) data.getOrDefault("player", color);
                String winner        = flaggedPlayer.equals("white") ? "black" : "white";
                endGameAndSave(gameId, winner, "TIMEOUT");
                broadcastToGame(gameId, Map.of(
                    "type",   "GAME_OVER",
                    "winner", winner,
                    "reason", (flaggedPlayer.equals("white") ? "White" : "Black") + " ran out of time"
                ));
            }

            case "GAME_OVER" -> {
                String winner = (String) data.getOrDefault("winner", "draw");
                String reason = (String) data.getOrDefault("reason", "Checkmate");
                endGameAndSave(gameId,
                        winner.equals("draw") ? null : winner,
                        reason.toUpperCase().replace(" ", "_"));
                broadcastToGame(gameId, Map.of(
                    "type",   "GAME_OVER",
                    "winner", winner,
                    "reason", reason
                ));
            }

            case "TIME_UPDATE" -> sendToOpponent(gameId, sessionId, data);

            default -> log.warn("⚠️ Unknown message type: {}", type);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = session.getId();
        Long   gameId    = sessionGame.get(sessionId);
        User   user      = sessionUsers.get(sessionId);

        log.info("🔌 Player {} disconnected from game {} ({})",
                user != null ? user.getName() : sessionId, gameId, status);

        if (gameId != null) {
            Set<WebSocketSession> players = gameSessions.get(gameId);
            if (players != null) {
                players.remove(session);
                if (!players.isEmpty()) {
                    broadcastToGame(gameId, Map.of(
                        "type",    "OPPONENT_DISCONNECTED",
                        "message", "Opponent disconnected"
                    ));
                }
                if (players.isEmpty()) {
                    gameSessions.remove(gameId);
                    gamePgn.remove(gameId);
                    gameMoveCount.remove(gameId);
                    gameLatestFen.remove(gameId);
                    gameEndLocks.remove(gameId);
                }
            }
        }

        sessionGame.remove(sessionId);
        sessionUsers.remove(sessionId);
        sessionColor.remove(sessionId);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.error("❌ Game transport error {}: {}", session.getId(), exception.getMessage());
        afterConnectionClosed(session, CloseStatus.SERVER_ERROR);
    }

    // ── Core: end game in multiplayer_games AND auto-save to games ────────────

    /**
     * Persist result to multiplayer_games, then auto-export both players'
     * records into the `games` table.
     *
     * KEY FIX: We acquire a per-gameId lock and immediately set mp.saved = true
     * BEFORE launching the async thread. This means even if both players send
     * GAME_OVER at the same time, only the first one through the lock will
     * launch the save; the second will see saved=true and return early.
     */
    private void endGameAndSave(Long gameId, String winnerColor, String reason) {
        try {
            Object lock = gameEndLocks.computeIfAbsent(gameId, k -> new Object());
            synchronized (lock) {
                MultiplayerGame mp = multiplayerGameRepository.findById(gameId).orElse(null);
                if (mp == null) return;

                // ── Already processed? bail out ───────────────────────────────
                if (Boolean.TRUE.equals(mp.getSaved())
                        || "FINISHED".equals(mp.getStatus())) {
                    log.info("ℹ️ Game #{} already finished/saved, skipping duplicate end", gameId);
                    return;
                }

                // ── 1. Update multiplayer_games ───────────────────────────────
                mp.setStatus("FINISHED");
                if (winnerColor != null) {
                    mp.setWinnerColor(winnerColor);
                    mp.setResult(winnerColor.equals("white") ? "WHITE_WIN" : "BLACK_WIN");
                } else {
                    mp.setWinnerColor("draw");
                    mp.setResult("DRAW");
                }
                mp.setTerminationReason(reason);
                mp.setEndedAt(Instant.now());
                mp.setCompletedAt(Instant.now());

                // Merge in-memory PGN
                StringBuilder inMemPgn = gamePgn.get(gameId);
                if (inMemPgn != null && inMemPgn.length() > 0) {
                    String resultTag = winnerColor == null ? "1/2-1/2"
                            : winnerColor.equals("white") ? "1-0" : "0-1";
                    mp.setPgn(inMemPgn.toString().trim() + " " + resultTag);
                }

                // ── 2. Mark saved=true NOW (before async thread) ──────────────
                // This prevents a second call to endGameAndSave (e.g. from the
                // other player's tab) from firing another async save.
                mp.setSaved(true);
                multiplayerGameRepository.save(mp);

                log.info("✅ multiplayer_games #{} finished — winner: {}, reason: {}",
                        gameId, winnerColor, reason);

                // ── 3. Export to games table async ────────────────────────────
                saveToGamesTableAsync(mp, winnerColor, reason);
            }
        } catch (Exception e) {
            log.error("❌ Error ending game {}: {}", gameId, e.getMessage(), e);
        }
    }

    /**
     * Export a finished multiplayer game to the `games` table for BOTH players.
     * Runs in a background thread so it does not block the WebSocket thread.
     */
    private void saveToGamesTableAsync(MultiplayerGame mp, String winnerColor, String reason) {
        // Capture values before handing off to thread
        final String pgn         = mp.getPgn()         != null ? mp.getPgn()         : "";
        final String timeControl = mp.getTimeControl() != null ? mp.getTimeControl() : "10+0";
        final String gameType    = mp.getGameType()    != null ? mp.getGameType()    : "STANDARD";
        final int    moveCount   = gameMoveCount.getOrDefault(mp.getId(), 0);
        final User   white       = mp.getWhitePlayer();
        final User   black       = mp.getBlackPlayer();
        final Long   whiteTimeMs = mp.getWhiteTimeRemainingMs();
        final Long   blackTimeMs = mp.getBlackTimeRemainingMs();
        final String uuid        = mp.getGameUuid();

        new Thread(() -> {
            try {
                // ── White player's record ─────────────────────────────────────
                String whiteResult = winnerColor == null ? "DRAW"
                        : winnerColor.equals("white") ? "WIN" : "LOSS";

                SaveGameRequest whiteReq = new SaveGameRequest(
                    black.getName(),    // opponentName
                    whiteResult,
                    pgn,
                    null,               // movesJson
                    1200,               // whiteRating (placeholder)
                    1200,               // blackRating (placeholder)
                    timeControl,
                    gameType,
                    reason,
                    moveCount,
                    whiteTimeMs,
                    blackTimeMs,
                    null,               // accuracyPercentage
                    white.getId(),
                    black.getId(),
                    uuid,
                    null                // openingName
                );

                int whiteRatingChange = whiteResult.equals("WIN") ? 16
                        : whiteResult.equals("LOSS") ? -16 : 0;

                gameService.saveGame(white, whiteReq, whiteRatingChange);
                log.info("✅ White player {} saved to games table (result={})",
                        white.getName(), whiteResult);

                // ── Black player's record ─────────────────────────────────────
                String blackResult = winnerColor == null ? "DRAW"
                        : winnerColor.equals("black") ? "WIN" : "LOSS";

                SaveGameRequest blackReq = new SaveGameRequest(
                    white.getName(),    // opponentName
                    blackResult,
                    pgn,
                    null,
                    1200,
                    1200,
                    timeControl,
                    gameType,
                    reason,
                    moveCount,
                    whiteTimeMs,
                    blackTimeMs,
                    null,
                    white.getId(),
                    black.getId(),
                    uuid + "-black",    // distinct UUID so dedup treats it separately
                    null
                );

                int blackRatingChange = blackResult.equals("WIN") ? 16
                        : blackResult.equals("LOSS") ? -16 : 0;

                gameService.saveGame(black, blackReq, blackRatingChange);
                log.info("✅ Black player {} saved to games table (result={})",
                        black.getName(), blackResult);

            } catch (Exception e) {
                log.error("❌ Failed to auto-save multiplayer game {} to games table: {}",
                        mp.getId(), e.getMessage(), e);
            }
        }, "game-save-" + mp.getId()).start();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void broadcastToGame(Long gameId, Map<String, Object> data) {
        Set<WebSocketSession> players = gameSessions.get(gameId);
        if (players == null) return;
        for (WebSocketSession s : players) send(s, data);
    }

    private void sendToOpponent(Long gameId, String senderSessionId, Map<String, Object> data) {
        Set<WebSocketSession> players = gameSessions.get(gameId);
        if (players == null) return;
        for (WebSocketSession s : players) {
            if (!s.getId().equals(senderSessionId)) send(s, data);
        }
    }

    private void send(WebSocketSession session, Map<String, Object> data) {
        try {
            if (session.isOpen())
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(data)));
        } catch (IOException e) {
            log.error("❌ Send error to {}: {}", session.getId(), e.getMessage());
        }
    }

    private Long extractGameId(String path) {
        try {
            String[] parts = path.split("/");
            return Long.parseLong(parts[parts.length - 1]);
        } catch (Exception e) {
            return null;
        }
    }

    private String extractParam(String query, String key) {
        if (query == null || query.isBlank()) return null;
        for (String part : query.split("&")) {
            String[] kv = part.split("=", 2);
            if (kv.length == 2 && kv[0].equals(key))
                return java.net.URLDecoder.decode(kv[1], java.nio.charset.StandardCharsets.UTF_8);
        }
        return null;
    }
}