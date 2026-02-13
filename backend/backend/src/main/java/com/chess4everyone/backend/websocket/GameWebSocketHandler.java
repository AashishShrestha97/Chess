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

import com.chess4everyone.backend.entity.MultiplayerGame;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.repo.UserRepository;
import com.chess4everyone.backend.repository.MultiplayerGameRepository;
import com.chess4everyone.backend.security.JwtService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Handles in-game WebSocket connections for live multiplayer chess.
 *
 * Frontend connects to: ws://localhost:8080/api/game/{gameId}?token=JWT
 *
 * Supported message types (client → server):
 *   MOVE        { from, to, promotion, san, fen, turn, player }
 *   OFFER_DRAW  {}
 *   ACCEPT_DRAW {}
 *   DECLINE_DRAW {}
 *   RESIGN      {}
 *   FLAG        { player }   (clock ran out)
 *   TIME_UPDATE { whiteTime, blackTime }
 *
 * Broadcast message types (server → clients):
 *   GAME_START      { whitePlayer, blackPlayer, timeControl, ... }
 *   WAITING_FOR_OPPONENT {}
 *   MOVE            (echoed to both with player field)
 *   DRAW_OFFER      {}
 *   DRAW_DECLINED   {}
 *   GAME_OVER       { winner, reason }
 *   OPPONENT_DISCONNECTED {}
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GameWebSocketHandler extends AbstractWebSocketHandler {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final MultiplayerGameRepository multiplayerGameRepository;
    private final ObjectMapper objectMapper;

    // gameId → set of sessions in that game
    private final Map<Long, Set<WebSocketSession>> gameSessions = new ConcurrentHashMap<>();

    // sessionId → gameId
    private final Map<String, Long> sessionGame = new ConcurrentHashMap<>();

    // sessionId → User
    private final Map<String, User> sessionUsers = new ConcurrentHashMap<>();

    // sessionId → color ("white" or "black")
    private final Map<String, String> sessionColor = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sessionId = session.getId();
        String path = session.getUri() != null ? session.getUri().getPath() : "";
        String query = session.getUri() != null ? session.getUri().getQuery() : "";

        // Extract gameId from path: /api/game/{gameId}
        Long gameId = extractGameId(path);
        String token = extractParam(query, "token");

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

        log.info("✅ Player {} connected to game {} as {}", user.getName(), gameId, color);

        Set<WebSocketSession> players = gameSessions.get(gameId);

        if (players.size() == 1) {
            // First player — wait for opponent
            send(session, Map.of("type", "WAITING_FOR_OPPONENT", "message", "Waiting for opponent to connect..."));
        } else if (players.size() >= 2) {
            // Both players connected — start the game
            broadcastToGame(gameId, Map.of(
                "type", "GAME_START",
                "gameId", gameId,
                "whitePlayer", game.getWhitePlayer().getName(),
                "blackPlayer", game.getBlackPlayer().getName(),
                "whitePlayerId", game.getWhitePlayer().getId(),
                "blackPlayerId", game.getBlackPlayer().getId(),
                "timeControl", game.getTimeControl(),
                "status", "ACTIVE"
            ));
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String sessionId = session.getId();
        Long gameId = sessionGame.get(sessionId);
        User user = sessionUsers.get(sessionId);
        String color = sessionColor.get(sessionId);

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
                // Broadcast move to both players (including sender — frontend filters echo)
                data.put("player", color);
                broadcastToGame(gameId, data);
            }

            case "OFFER_DRAW" -> broadcastToGame(gameId, Map.of(
                "type", "DRAW_OFFER",
                "from", color
            ));

            case "ACCEPT_DRAW" -> {
                endGame(gameId, null, "DRAW_AGREEMENT");
                broadcastToGame(gameId, Map.of(
                    "type", "GAME_OVER",
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
                endGame(gameId, winner, "RESIGN");
                broadcastToGame(gameId, Map.of(
                    "type", "GAME_OVER",
                    "winner", winner,
                    "reason", (color.equals("white") ? "White" : "Black") + " resigned"
                ));
            }

            case "FLAG" -> {
                // Player ran out of time — opponent wins
                String flaggedPlayer = (String) data.getOrDefault("player", color);
                String winner = flaggedPlayer.equals("white") ? "black" : "white";
                endGame(gameId, winner, "TIMEOUT");
                broadcastToGame(gameId, Map.of(
                    "type", "GAME_OVER",
                    "winner", winner,
                    "reason", (flaggedPlayer.equals("white") ? "White" : "Black") + " ran out of time"
                ));
            }

            case "GAME_OVER" -> {
                // Sent by a player reporting checkmate/stalemate
                String winner = (String) data.getOrDefault("winner", "draw");
                String reason = (String) data.getOrDefault("reason", "Checkmate");
                endGame(gameId, winner.equals("draw") ? null : winner, reason.toUpperCase().replace(" ", "_"));
                broadcastToGame(gameId, Map.of(
                    "type", "GAME_OVER",
                    "winner", winner,
                    "reason", reason
                ));
            }

            case "TIME_UPDATE" -> {
                // Just forward to opponent for clock sync — don't persist
                broadcastToGame(gameId, data);
            }

            default -> log.warn("⚠️ Unknown message type: {}", type);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = session.getId();
        Long gameId = sessionGame.get(sessionId);
        User user = sessionUsers.get(sessionId);

        log.info("🔌 Player {} disconnected from game {} ({})",
                user != null ? user.getName() : sessionId, gameId, status);

        if (gameId != null) {
            Set<WebSocketSession> players = gameSessions.get(gameId);
            if (players != null) {
                players.remove(session);

                // Notify remaining player
                if (!players.isEmpty()) {
                    broadcastToGame(gameId, Map.of(
                        "type", "OPPONENT_DISCONNECTED",
                        "message", "Opponent disconnected"
                    ));
                }

                if (players.isEmpty()) {
                    gameSessions.remove(gameId);
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

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void broadcastToGame(Long gameId, Map<String, Object> data) {
        Set<WebSocketSession> players = gameSessions.get(gameId);
        if (players == null) return;

        for (WebSocketSession s : players) {
            send(s, data);
        }
    }

    private void send(WebSocketSession session, Map<String, Object> data) {
        try {
            if (session.isOpen()) {
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(data)));
            }
        } catch (IOException e) {
            log.error("❌ Send error to {}: {}", session.getId(), e.getMessage());
        }
    }

    private void endGame(Long gameId, String winnerColor, String reason) {
        try {
            MultiplayerGame game = multiplayerGameRepository.findById(gameId).orElse(null);
            if (game == null) return;
            game.setStatus("FINISHED");
            game.setWinnerColor(winnerColor != null ? winnerColor : "draw");
            game.setTerminationReason(reason);
            game.setEndedAt(Instant.now());
            multiplayerGameRepository.save(game);
            log.info("✅ Game {} finished — winner: {}, reason: {}", gameId, winnerColor, reason);
        } catch (Exception e) {
            log.error("❌ Error ending game {}: {}", gameId, e.getMessage());
        }
    }

    private Long extractGameId(String path) {
        // Path: /api/game/123
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
            if (kv.length == 2 && kv[0].equals(key)) {
                return java.net.URLDecoder.decode(kv[1], java.nio.charset.StandardCharsets.UTF_8);
            }
        }
        return null;
    }
}