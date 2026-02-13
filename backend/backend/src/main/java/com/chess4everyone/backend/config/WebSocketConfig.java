package com.chess4everyone.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import com.chess4everyone.backend.websocket.DeepgramSTTWebSocketHandler;
import com.chess4everyone.backend.websocket.GameWebSocketHandler;
import com.chess4everyone.backend.websocket.MatchmakingWebSocketHandler;

/**
 * WebSocket configuration for:
 *  - Deepgram STT proxy  →  /api/deepgram/listen
 *  - Matchmaking         →  /api/matchmaking
 *  - Live game           →  /api/game/{gameId}
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final DeepgramSTTWebSocketHandler deepgramSTTWebSocketHandler;
    private final MatchmakingWebSocketHandler matchmakingWebSocketHandler;
    private final GameWebSocketHandler gameWebSocketHandler;

    public WebSocketConfig(
            DeepgramSTTWebSocketHandler deepgramSTTWebSocketHandler,
            MatchmakingWebSocketHandler matchmakingWebSocketHandler,
            GameWebSocketHandler gameWebSocketHandler) {
        this.deepgramSTTWebSocketHandler = deepgramSTTWebSocketHandler;
        this.matchmakingWebSocketHandler = matchmakingWebSocketHandler;
        this.gameWebSocketHandler = gameWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
        // Deepgram STT proxy
        registry.addHandler(deepgramSTTWebSocketHandler, "/api/deepgram/listen")
                .setAllowedOrigins("*");

        // Matchmaking — pair players waiting for the same time control
        registry.addHandler(matchmakingWebSocketHandler, "/api/matchmaking")
                .setAllowedOrigins("*");

        // Live game — handles moves, draw offers, resign, clock sync
        // The path pattern /api/game/* matches /api/game/1, /api/game/42, etc.
        registry.addHandler(gameWebSocketHandler, "/api/game/*")
                .setAllowedOrigins("*");
    }
}