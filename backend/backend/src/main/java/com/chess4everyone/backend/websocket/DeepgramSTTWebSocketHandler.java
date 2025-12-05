package com.chess4everyone.backend.websocket;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

/**
 * WebSocket handler that proxies frontend WebSocket connections to Deepgram STT API.
 *
 * Frontend connects to:
 *   ws://localhost:8080/api/deepgram/listen?language=en-IN&model=nova-2&...
 *
 * This handler:
 *   - Validates that a Deepgram API key is configured
 *   - Opens a backend WebSocket to Deepgram using the API key in the Authorization header
 *   - Forwards binary audio data (16kHz, mono, linear16) from the browser to Deepgram
 *   - Forwards JSON text messages from Deepgram back to the browser
 */
@Component
public class DeepgramSTTWebSocketHandler extends AbstractWebSocketHandler {

    private static final String DEEPGRAM_WSS_URL = "wss://api.deepgram.com/v1/listen";

    // One Deepgram client per frontend WebSocket session
    private static final ConcurrentHashMap<String, DeepgramWSClient> deepgramClients =
            new ConcurrentHashMap<>();

    // Execute Deepgram connection off the main WebSocket thread
    private static final ExecutorService executor = Executors.newCachedThreadPool();

    // Inject Deepgram API key from application.properties
    @Value("${deepgram.api.key:}")
    private String deepgramApiKey;

    @Override
    public void afterConnectionEstablished(WebSocketSession frontendSession) throws Exception {
        String sessionId = frontendSession.getId();
        System.out.println("✅ Frontend WebSocket connected: " + sessionId);

        try {
            // Verify API key is configured
            if (deepgramApiKey == null
                    || deepgramApiKey.isBlank()
                    || deepgramApiKey.contains("YOUR_DEEPGRAM_API_KEY")) {
                System.err.println("❌ Deepgram API key not configured in application.properties");
                frontendSession.close(
                        CloseStatus.BAD_DATA.withReason("Server not configured: missing API key"));
                return;
            }

            // Log length only, never full key
            System.out.println(
                    "🔑 Deepgram API key length: " + deepgramApiKey.length() + " characters");

            // Build Deepgram URL, preserving query parameters from the frontend
            String query =
                    frontendSession.getUri() != null ? frontendSession.getUri().getQuery() : null;
            String deepgramUrl =
                    DEEPGRAM_WSS_URL
                            + (query != null && !query.isBlank() ? "?" + query : "");
            System.out.println("🔗 Deepgram WSS URL: " + deepgramUrl);

            // Create client that will manage backend<->Deepgram WebSocket
            DeepgramWSClient deepgramClient =
                    new DeepgramWSClient(
                            deepgramApiKey,
                            deepgramUrl,
                            frontendSession,
                            sessionId
                    );

            deepgramClients.put(sessionId, deepgramClient);

            // Connect to Deepgram asynchronously
            executor.execute(() -> {
                try {
                    System.out.println("🔌 Connecting to Deepgram for session: " + sessionId);
                    deepgramClient.connect();
                    System.out.println(
                            "✅ Deepgram WebSocket connected for session: " + sessionId);
                } catch (Exception e) {
                    System.err.println("❌ Failed to connect to Deepgram for session "
                            + sessionId + ": " + e.getMessage());
                    e.printStackTrace();
                    try {
                        frontendSession.close(
                                CloseStatus.SERVER_ERROR.withReason("Deepgram connection failed"));
                    } catch (IOException ex) {
                        System.err.println(
                                "❌ Error closing frontend session: " + ex.getMessage());
                    }
                    deepgramClients.remove(sessionId);
                }
            });

        } catch (Exception e) {
            System.err.println("❌ Error in afterConnectionEstablished for session "
                    + sessionId + ": " + e.getMessage());
            e.printStackTrace();
            try {
                frontendSession.close(CloseStatus.SERVER_ERROR);
            } catch (IOException ex) {
                System.err.println("❌ Error closing session: " + ex.getMessage());
            }
        }
    }

    @Override
    protected void handleBinaryMessage(
            WebSocketSession frontendSession,
            BinaryMessage message
    ) throws Exception {
        String sessionId = frontendSession.getId();
        DeepgramWSClient deepgramClient = deepgramClients.get(sessionId);

        if (deepgramClient == null) {
            System.err.println("⚠️ No Deepgram client for session "
                    + sessionId + " (binary message ignored)");
            return;
        }

        ByteBuffer buffer = message.getPayload();
        byte[] audioData = new byte[buffer.remaining()];
        buffer.get(audioData);

        try {
            deepgramClient.sendAudioData(audioData);
        } catch (Exception e) {
            System.err.println("❌ Error forwarding audio to Deepgram for session "
                    + sessionId + ": " + e.getMessage());
            e.printStackTrace();
            try {
                frontendSession.close(
                        CloseStatus.SERVER_ERROR.withReason("Failed to send audio to Deepgram"));
            } catch (IOException ex) {
                System.err.println("❌ Error closing frontend session: " + ex.getMessage());
            }
            deepgramClients.remove(sessionId);
            deepgramClient.close();
        }
    }

    @Override
    protected void handleTextMessage(
            WebSocketSession frontendSession,
            TextMessage message
    ) throws Exception {
        String sessionId = frontendSession.getId();
        DeepgramWSClient deepgramClient = deepgramClients.get(sessionId);

        if (deepgramClient == null) {
            System.err.println("⚠️ No Deepgram client for session "
                    + sessionId + " (text message ignored)");
            return;
        }

        String payload = message.getPayload();
        try {
            deepgramClient.sendTextMessage(payload);
        } catch (Exception e) {
            System.err.println("❌ Error forwarding text to Deepgram for session "
                    + sessionId + ": " + e.getMessage());
            e.printStackTrace();
            try {
                frontendSession.close(
                        CloseStatus.SERVER_ERROR.withReason("Failed to send text to Deepgram"));
            } catch (IOException ex) {
                System.err.println("❌ Error closing frontend session: " + ex.getMessage());
            }
            deepgramClients.remove(sessionId);
            deepgramClient.close();
        }
    }

    @Override
    public void afterConnectionClosed(
            WebSocketSession frontendSession,
            CloseStatus status
    ) throws Exception {
        String sessionId = frontendSession.getId();
        System.out.println("🔌 Frontend WebSocket closed: " + sessionId + " - " + status);

        DeepgramWSClient deepgramClient = deepgramClients.remove(sessionId);
        if (deepgramClient != null) {
            deepgramClient.close();
        }
    }

    @Override
    public void handleTransportError(
            WebSocketSession frontendSession,
            Throwable exception
    ) throws Exception {
        String sessionId = frontendSession.getId();
        System.err.println("❌ Transport error on session "
                + sessionId + ": " + exception.getMessage());
        exception.printStackTrace();

        DeepgramWSClient deepgramClient = deepgramClients.remove(sessionId);
        if (deepgramClient != null) {
            deepgramClient.close();
        }
    }
}
