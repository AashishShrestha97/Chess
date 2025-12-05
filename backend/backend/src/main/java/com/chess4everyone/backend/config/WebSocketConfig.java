package com.chess4everyone.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import com.chess4everyone.backend.websocket.DeepgramSTTWebSocketHandler;

/**
 * WebSocket configuration for Deepgram STT proxy.
 *
 * Frontend connects to:
 *   ws://localhost:8080/api/deepgram/listen
 * and this handler proxies that connection to Deepgram's WSS endpoint.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final DeepgramSTTWebSocketHandler deepgramSTTWebSocketHandler;

    // Spring injects the @Component handler so @Value fields are populated
    public WebSocketConfig(DeepgramSTTWebSocketHandler deepgramSTTWebSocketHandler) {
        this.deepgramSTTWebSocketHandler = deepgramSTTWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
        registry.addHandler(deepgramSTTWebSocketHandler, "/api/deepgram/listen")
                // You can restrict this to your frontend origin(s) if you want:
                // .setAllowedOrigins("http://localhost:5173")
                .setAllowedOrigins("*");
    }
}
