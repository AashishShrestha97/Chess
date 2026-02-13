package com.chess4everyone.backend.websocket;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.Queue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

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
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Handles matchmaking WebSocket connections.
 * Frontend connects to: ws://localhost:8080/api/matchmaking?token=JWT&timeControl=10+0
 *
 * Flow:
 *  1. Player connects → authenticated via JWT query param
 *  2. Player added to waiting queue for their time control
 *  3. When two players are waiting → create game → notify both with GAME_FOUND
 *  4. Both players disconnect from matchmaking and connect to /api/game/{gameId}
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MatchmakingWebSocketHandler extends AbstractWebSocketHandler {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final MultiplayerGameRepository multiplayerGameRepository;
    private final ObjectMapper objectMapper;

    // sessionId → WebSocketSession
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    // sessionId → User
    private final Map<String, User> sessionUsers = new ConcurrentHashMap<>();

    // sessionId → timeControl they're waiting for
    private final Map<String, String> sessionTimeControl = new ConcurrentHashMap<>();

    // timeControl → queue of waiting sessionIds
    private final Map<String, Queue<String>> waitingQueues = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sessionId = session.getId();
        log.info("🎯 Matchmaking connection: {}", sessionId);

        // Extract token and timeControl from query params
        String query = session.getUri() != null ? session.getUri().getQuery() : "";
        String token = extractParam(query, "token");
        String timeControl = extractParam(query, "timeControl");

        if (token == null || token.isBlank()) {
            log.warn("❌ No token provided for matchmaking session {}", sessionId);
            session.close(CloseStatus.BAD_DATA.withReason("Missing token"));
            return;
        }

        if (timeControl == null || timeControl.isBlank()) {
            timeControl = "10+0"; // default
        }

        // Authenticate
        User user;
        try {
            String userId = jwtService.parseToken(token).getBody().getSubject();
            user = userRepository.findById(Long.valueOf(userId))
                    .orElseThrow(() -> new RuntimeException("User not found"));
        } catch (Exception e) {
            log.warn("❌ Invalid token for matchmaking session {}: {}", sessionId, e.getMessage());
            session.close(CloseStatus.BAD_DATA.withReason("Invalid token"));
            return;
        }

        sessions.put(sessionId, session);
        sessionUsers.put(sessionId, user);
        sessionTimeControl.put(sessionId, timeControl);

        log.info("✅ Player {} ({}) waiting for {} game", user.getName(), sessionId, timeControl);

        // Notify player they're in queue
        send(session, Map.of("type", "WAITING", "message", "Looking for opponent..."));

        // Try to match
        tryMatch(sessionId, timeControl);
    }

    private void tryMatch(String newSessionId, String timeControl) {
        Queue<String> queue = waitingQueues.computeIfAbsent(timeControl, k -> new ConcurrentLinkedQueue<>());

        // Drain stale/disconnected sessions from front of queue
        String opponentSessionId = null;
        while (!queue.isEmpty()) {
            String candidate = queue.peek();
            WebSocketSession candidateSession = sessions.get(candidate);
            if (candidateSession != null && candidateSession.isOpen() && !candidate.equals(newSessionId)) {
                opponentSessionId = queue.poll();
                break;
            } else {
                queue.poll(); // remove stale
            }
        }

        if (opponentSessionId == null) {
            // No opponent yet — add to queue
            queue.add(newSessionId);
            log.info("⏳ Player {} added to {} queue (queue size: {})",
                    newSessionId, timeControl, queue.size());
            return;
        }

        // Found a match!
        User player1 = sessionUsers.get(opponentSessionId); // was waiting first
        User player2 = sessionUsers.get(newSessionId);       // just joined

        if (player1 == null || player2 == null) {
            log.error("❌ Missing user data during match creation");
            queue.add(newSessionId); // put back
            return;
        }

        // Randomly assign colors (first waiter gets white)
        User whitePlayer = player1;
        User blackPlayer = player2;

        // Create game record
        MultiplayerGame game = new MultiplayerGame();
        game.setWhitePlayer(whitePlayer);
        game.setBlackPlayer(blackPlayer);
        game.setTimeControl(timeControl);
        game.setStatus("ACTIVE");
        game.setStartedAt(Instant.now());
        MultiplayerGame saved = multiplayerGameRepository.save(game);

        log.info("✅ Match found! Game #{} — {} (white) vs {} (black) [{}]",
                saved.getId(), whitePlayer.getName(), blackPlayer.getName(), timeControl);

        // Notify both players
        WebSocketSession session1 = sessions.get(opponentSessionId);
        WebSocketSession session2 = sessions.get(newSessionId);

        notifyGameFound(session1, saved, "white", whitePlayer, blackPlayer);
        notifyGameFound(session2, saved, "black", whitePlayer, blackPlayer);

        // Clean up matchmaking sessions (they'll reconnect to game WS)
        cleanup(opponentSessionId);
        cleanup(newSessionId);
    }

    private void notifyGameFound(WebSocketSession session, MultiplayerGame game,
                                  String color, User white, User black) {
        if (session == null || !session.isOpen()) return;

        try {
            Map<String, Object> msg = Map.of(
                "type", "GAME_FOUND",
                "gameId", game.getId(),
                "color", color,
                "timeControl", game.getTimeControl(),
                "whitePlayer", white.getName(),
                "blackPlayer", black.getName(),
                "whitePlayerId", white.getId(),
                "blackPlayerId", black.getId()
            );
            send(session, msg);
        } catch (Exception e) {
            log.error("❌ Error notifying player of game found: {}", e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = session.getId();
        log.info("🔌 Matchmaking disconnected: {} ({})", sessionId, status);

        String timeControl = sessionTimeControl.get(sessionId);
        if (timeControl != null) {
            Queue<String> queue = waitingQueues.get(timeControl);
            if (queue != null) queue.remove(sessionId);
        }

        cleanup(sessionId);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.error("❌ Matchmaking transport error {}: {}", session.getId(), exception.getMessage());
        afterConnectionClosed(session, CloseStatus.SERVER_ERROR);
    }

    private void cleanup(String sessionId) {
        sessions.remove(sessionId);
        sessionUsers.remove(sessionId);
        sessionTimeControl.remove(sessionId);
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