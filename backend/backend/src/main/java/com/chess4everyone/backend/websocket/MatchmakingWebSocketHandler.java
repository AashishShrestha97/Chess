package com.chess4everyone.backend.websocket;

import java.io.IOException;
import java.time.Instant;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.PingMessage;
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
 * Matchmaking WebSocket handler.
 *
 * Frontend URL: ws://localhost:8080/api/matchmaking?token=JWT&timeControl=10+0&gameType=STANDARD
 *
 * Flow:
 *  1. Player connects → authenticated via JWT query param
 *  2. Player added to queue for their EXACT timeControl + gameType pair
 *  3. When two players match → create game → notify both with GAME_FOUND
 *  4. Both players navigate to StandardChessPage or VoiceGamePage
 *
 * Key fixes vs. previous version:
 *  - Queue key = timeControl + "|" + gameType  →  STANDARD and VOICE NEVER cross-match
 *  - afterConnectionClosed removes player from queue immediately (no ghost sessions)
 *  - LinkedList + synchronized scan validates every candidate before matching
 *  - Scheduler pings all sessions every 5 s and purges dead ones
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

    // sessionId → authenticated User
    private final Map<String, User> sessionUsers = new ConcurrentHashMap<>();

    // sessionId → queueKey (e.g. "10+0|STANDARD")
    private final Map<String, String> sessionQueueKey = new ConcurrentHashMap<>();

    // queueKey → ordered list of waiting sessionIds
    // LinkedList so we can O(n) remove from any position
    private final Map<String, LinkedList<String>> waitingQueues = new ConcurrentHashMap<>();

    // Pings sessions every 5 s; dead sessions fire afterConnectionClosed automatically
    private final ScheduledExecutorService scheduler =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "matchmaking-cleanup");
                t.setDaemon(true);
                return t;
            });

    {
        scheduler.scheduleAtFixedRate(this::purgeDeadSessions, 5, 5, TimeUnit.SECONDS);
    }

    // ─── lifecycle ────────────────────────────────────────────────────────────

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sessionId = session.getId();
        String query     = session.getUri() != null ? session.getUri().getQuery() : "";

        String token       = extractParam(query, "token");
        String timeControl = extractParam(query, "timeControl");
        String gameType    = extractParam(query, "gameType");

        if (token == null || token.isBlank()) {
            log.warn("No token from session {}", sessionId);
            session.close(CloseStatus.BAD_DATA.withReason("Missing token"));
            return;
        }

        User user;
        try {
            String userId = jwtService.parseToken(token).getBody().getSubject();
            user = userRepository.findById(Long.valueOf(userId))
                    .orElseThrow(() -> new RuntimeException("User not found"));
        } catch (Exception e) {
            log.warn("Invalid token {}: {}", sessionId, e.getMessage());
            session.close(CloseStatus.BAD_DATA.withReason("Invalid token"));
            return;
        }

        if (timeControl == null || timeControl.isBlank()) timeControl = "10+0";
        if (gameType    == null || gameType.isBlank())    gameType    = "STANDARD";
        gameType = gameType.toUpperCase();

        // Queue key: EXACT match on both timeControl AND gameType
        String queueKey = timeControl + "|" + gameType;

        // Evict any stale session belonging to the same user in this queue
        // (handles refresh / duplicate-tab scenario before self-match can occur)
        evictUserFromQueue(user.getId(), queueKey);

        sessions.put(sessionId, session);
        sessionUsers.put(sessionId, user);
        sessionQueueKey.put(sessionId, queueKey);

        log.info("Player {} entered queue [{}]", user.getName(), queueKey);

        send(session, Map.of(
            "type",        "WAITING",
            "message",     "Searching for opponent (" + timeControl + " · " + gameType + ")...",
            "timeControl", timeControl,
            "gameType",    gameType
        ));

        tryMatch(sessionId, queueKey, user, timeControl, gameType);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = objectMapper.readValue(message.getPayload(), Map.class);
            if ("CANCEL".equals(data.get("type"))) {
                log.info("Session {} cancelled matchmaking", session.getId());
                removeFromQueue(session.getId());
                try { session.close(CloseStatus.NORMAL); } catch (IOException ignored) {}
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = session.getId();
        User user = sessionUsers.get(sessionId);
        log.info("Matchmaking closed: {} status={}", user != null ? user.getName() : sessionId, status);
        // Immediately remove from queue — prevents instant ghost-match for next joiner
        removeFromQueue(sessionId);
        cleanup(sessionId);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable ex) {
        log.error("Matchmaking transport error {}: {}", session.getId(), ex.getMessage());
        afterConnectionClosed(session, CloseStatus.SERVER_ERROR);
    }

    // ─── matching ─────────────────────────────────────────────────────────────

    private void tryMatch(String newSid, String queueKey,
                          User newUser, String timeControl, String gameType) {

        LinkedList<String> queue =
                waitingQueues.computeIfAbsent(queueKey, k -> new LinkedList<>());

        synchronized (queue) {
            // Walk the queue for the first live opponent that isn't ourselves
            String opponentSid = null;
            Iterator<String> it = queue.iterator();
            while (it.hasNext()) {
                String candidate = it.next();

                if (candidate.equals(newSid)) { it.remove(); continue; }

                WebSocketSession ws = sessions.get(candidate);
                if (ws == null || !ws.isOpen()) {
                    it.remove();
                    cleanup(candidate);
                    log.debug("Removed dead session {} from [{}]", candidate, queueKey);
                    continue;
                }

                // Prevent self-match: skip any waiting session that belongs to the same user
                User candidateUser = sessionUsers.get(candidate);
                if (candidateUser != null && candidateUser.getId().equals(newUser.getId())) {
                    log.debug("Skipping self-match: same user {} already waiting as session {}",
                              newUser.getName(), candidate);
                    continue;
                }

                opponentSid = candidate;
                it.remove();
                break;
            }

            if (opponentSid == null) {
                queue.addLast(newSid);
                log.info("{} waiting in [{}] (depth: {})", newUser.getName(), queueKey, queue.size());
                return;
            }

            // ── Pair found ───────────────────────────────────────────────────
            User opponent = sessionUsers.get(opponentSid);
            if (opponent == null) {
                queue.addLast(newSid);
                return;
            }

            User whitePlayer = opponent; // waited longer → white
            User blackPlayer = newUser;

            try {
                MultiplayerGame game = new MultiplayerGame();
                game.setGameUuid(UUID.randomUUID().toString());
                game.setWhitePlayer(whitePlayer);
                game.setBlackPlayer(blackPlayer);
                game.setTimeControl(timeControl);
                game.setGameType(gameType);
                game.setStatus("WAITING");
                game.setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
                long initialMs = parseTimeControlToMs(timeControl);
                game.setWhiteTimeRemainingMs(initialMs);
                game.setBlackTimeRemainingMs(initialMs);
                game.setStartedAt(Instant.now());

                MultiplayerGame saved = multiplayerGameRepository.save(game);

                log.info("Game #{} — {} (white) vs {} (black) [{}]",
                        saved.getId(), whitePlayer.getName(), blackPlayer.getName(), queueKey);

                notifyGameFound(sessions.get(opponentSid), saved, "white", whitePlayer, blackPlayer);
                notifyGameFound(sessions.get(newSid),      saved, "black", whitePlayer, blackPlayer);

            } catch (Exception e) {
                log.error("Failed to create game: {}", e.getMessage(), e);
                queue.addFirst(opponentSid);
                queue.addLast(newSid);
            }
        }
    }

    private void notifyGameFound(WebSocketSession session, MultiplayerGame game,
                                  String color, User white, User black) {
        if (session == null || !session.isOpen()) return;
        try {
            send(session, Map.of(
                "type",          "GAME_FOUND",
                "gameId",        game.getId(),       // Long DB id — used in WS path /api/game/{gameId}
                "gameUuid",      game.getGameUuid(),
                "color",         color,
                "timeControl",   game.getTimeControl(),
                "gameType",      game.getGameType(),
                "whitePlayer",   white.getName(),
                "blackPlayer",   black.getName(),
                "whitePlayerId", white.getId(),
                "blackPlayerId", black.getId()
            ));
        } catch (Exception e) {
            log.error("notifyGameFound error: {}", e.getMessage());
        }
    }

    // ─── cleanup ──────────────────────────────────────────────────────────────

    /** Scheduled every 5 s: ping sessions, then sweep dead ones from all queues. */
    private void purgeDeadSessions() {
        for (WebSocketSession ws : sessions.values()) {
            if (ws.isOpen()) {
                try { ws.sendMessage(new PingMessage()); } catch (Exception ignored) {}
            }
        }
        for (Map.Entry<String, LinkedList<String>> entry : waitingQueues.entrySet()) {
            LinkedList<String> queue = entry.getValue();
            synchronized (queue) {
                Iterator<String> it = queue.iterator();
                while (it.hasNext()) {
                    String sid = it.next();
                    WebSocketSession ws = sessions.get(sid);
                    if (ws == null || !ws.isOpen()) {
                        it.remove();
                        cleanup(sid);
                        log.debug("Purged stale {} from [{}]", sid, entry.getKey());
                    }
                }
            }
        }
    }

    /** Remove all waiting sessions in the given queue that belong to userId. */
    private void evictUserFromQueue(Long userId, String queueKey) {
        LinkedList<String> queue = waitingQueues.get(queueKey);
        if (queue == null) return;
        synchronized (queue) {
            Iterator<String> it = queue.iterator();
            while (it.hasNext()) {
                String sid = it.next();
                User u = sessionUsers.get(sid);
                if (u != null && u.getId().equals(userId)) {
                    it.remove();
                    log.debug("Evicted stale session {} for user {} from [{}]", sid, userId, queueKey);
                    cleanup(sid);
                }
            }
        }
    }

    private void removeFromQueue(String sessionId) {
        String queueKey = sessionQueueKey.get(sessionId);
        if (queueKey == null) return;
        LinkedList<String> queue = waitingQueues.get(queueKey);
        if (queue != null) { synchronized (queue) { queue.remove(sessionId); } }
    }

    private void cleanup(String sessionId) {
        sessions.remove(sessionId);
        sessionUsers.remove(sessionId);
        sessionQueueKey.remove(sessionId);
    }

    // ─── utilities ────────────────────────────────────────────────────────────

    private void send(WebSocketSession session, Map<String, Object> data) {
        try {
            if (session != null && session.isOpen()) {
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(data)));
            }
        } catch (IOException e) {
            log.error("Send error to {}: {}", session.getId(), e.getMessage());
        }
    }

    private String extractParam(String query, String key) {
        if (query == null || query.isBlank()) return null;
        for (String part : query.split("&")) {
            String[] kv = part.split("=", 2);
            if (kv.length == 2 && kv[0].equals(key)) {
                return java.net.URLDecoder.decode(
                    kv[1], java.nio.charset.StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    private long parseTimeControlToMs(String tc) {
        try {
            long minutes = Long.parseLong(tc.split("\\+")[0]);
            return minutes * 60_000L;
        } catch (Exception e) {
            return 600_000L; // 10 min default
        }
    }
}