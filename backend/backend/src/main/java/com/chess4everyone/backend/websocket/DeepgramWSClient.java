package com.chess4everyone.backend.websocket;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.net.http.WebSocket.Listener;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

/**
 * Client for connecting to Deepgram WebSocket and proxying messages
 * 
 * This class manages the backend's WebSocket connection to Deepgram's STT API
 * and forwards audio/messages between frontend and Deepgram.
 */
public class DeepgramWSClient implements Listener {
    
    private final String apiKey;
    private final String deepgramUrl;
    private final WebSocketSession frontendSession;
    private final String sessionId;
    private WebSocket deepgramSocket;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile boolean isConnected = false;
    private final CountDownLatch connectLatch = new CountDownLatch(1);
    private volatile Exception connectException;
    
    public DeepgramWSClient(String apiKey, String deepgramUrl, WebSocketSession frontendSession, String sessionId) {
        this.apiKey = apiKey;
        this.deepgramUrl = deepgramUrl;
        this.frontendSession = frontendSession;
        this.sessionId = sessionId;
    }
    
    /**
     * Establish connection to Deepgram WebSocket with Authorization header
     */
    public void connect() throws Exception {
        System.out.println("🔗 Creating Deepgram WebSocket connection...");
        System.out.println("🔗 Deepgram URL: " + deepgramUrl);
        System.out.println("🔗 API key length: " + apiKey.length() + " characters");
        
        if (apiKey.length() < 30) {
            throw new Exception("❌ INVALID API KEY: API key is too short (" + apiKey.length() + " chars). " +
                "Valid Deepgram keys start with 'dg_' and are at least 30-40 characters. " +
                "Please verify your API key at https://console.deepgram.com");
        }
        
        if (!apiKey.startsWith("dg_")) {
            System.out.println("⚠️ WARNING: API key does not start with 'dg_' - this may be invalid");
        }
        
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
        
        try {
            CompletableFuture<WebSocket> wsFuture = client.newWebSocketBuilder()
                    .header("Authorization", "Token " + apiKey)
                    .header("Content-Type", "application/json")
                    .buildAsync(java.net.URI.create(deepgramUrl), this);
            
            wsFuture.thenAccept(ws -> {
                this.deepgramSocket = ws;
                this.isConnected = true;
                System.out.println("✅ Deepgram WebSocket connected for session: " + sessionId);
                connectLatch.countDown();
            }).exceptionally(ex -> {
                System.err.println("❌ Failed to connect to Deepgram: " + ex.getMessage());
                ex.printStackTrace();
                if (ex.getMessage() != null && ex.getMessage().contains("401")) {
                    System.err.println("❌ AUTHENTICATION FAILED (401): Your Deepgram API key is invalid or expired.");
                    System.err.println("💡 Please verify your API key at: https://console.deepgram.com/");
                }
                this.connectException = (Exception) ex;
                this.isConnected = false;
                connectLatch.countDown();
                try {
                    frontendSession.close(CloseStatus.SERVER_ERROR.withReason("Deepgram connection failed"));
                } catch (IOException e) {
                    System.err.println("❌ Error closing frontend session: " + e.getMessage());
                }
                return null;
            });
            
            // Wait for connection with timeout
            boolean connected = connectLatch.await(15, TimeUnit.SECONDS);
            if (!connected) {
                throw new Exception("Deepgram WebSocket connection timeout");
            }
            if (connectException != null) {
                throw connectException;
            }
            
            System.out.println("✅ Deepgram connection established");
        } catch (Exception e) {
            System.err.println("❌ Connection failed: " + e.getMessage());
            e.printStackTrace();
            try {
                frontendSession.close(CloseStatus.SERVER_ERROR.withReason("Connection failed"));
            } catch (IOException ex) {
                System.err.println("❌ Error closing frontend session: " + ex.getMessage());
            }
            throw e;
        }
    }
    
    /**
     * Send audio data to Deepgram
     */
    public void sendAudioData(byte[] audioData) throws Exception {
        if (deepgramSocket == null || !isConnected) {
            System.err.println("❌ Deepgram socket not connected - audio not sent (" + audioData.length + " bytes)");
            return;
        }
        
        try {
            // Send as binary frame - use sendBinary which returns CompletableFuture
            deepgramSocket.sendBinary(ByteBuffer.wrap(audioData), true);
        } catch (Exception e) {
            System.err.println("❌ Error sending audio to Deepgram: " + e.getMessage());
            throw e;
        }
    }
    
    /**
     * Send text message to Deepgram (like keep-alive or close message)
     */
    public void sendTextMessage(String message) throws Exception {
        if (deepgramSocket == null || !isConnected) {
            System.err.println("❌ Deepgram socket not connected");
            return;
        }
        
        try {
            deepgramSocket.sendText(message, true);
        } catch (Exception e) {
            System.err.println("❌ Error sending text to Deepgram: " + e.getMessage());
            throw e;
        }
    }
    
    /**
     * Close connection
     */
    public void close() {
        if (deepgramSocket != null) {
            try {
                deepgramSocket.sendClose(WebSocket.NORMAL_CLOSURE, "closing");
            } catch (Exception e) {
                System.err.println("❌ Error closing Deepgram socket: " + e.getMessage());
            }
            isConnected = false;
        }
        executor.shutdown();
    }
    
    
    // ========== WebSocket Listener Implementation ==========
    
    @Override
    public void onOpen(WebSocket webSocket) {
        System.out.println("✅ Deepgram WebSocket onOpen - ready to send/receive");
        isConnected = true;
        // CRITICAL: Request more data to ensure onText gets called
        webSocket.request(1);
    }
    
    @Override
    public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
        String message = data.toString();
        System.out.println("📨 Deepgram message received: " + message.substring(0, Math.min(100, message.length())));
        
        // Forward text message from Deepgram to frontend
        try {
            if (frontendSession.isOpen()) {
                frontendSession.sendMessage(new TextMessage(message));
                System.out.println("✅ Message forwarded to frontend");
            } else {
                System.err.println("⚠️ Frontend session closed, cannot forward message");
            }
        } catch (IOException e) {
            System.err.println("❌ Error sending text to frontend: " + e.getMessage());
            e.printStackTrace();
        }
        
        // CRITICAL: Request more data to continue receiving messages
        webSocket.request(1);
        
        return CompletableFuture.completedFuture(null);
    }
    
    @Override
    public CompletionStage<?> onBinary(WebSocket webSocket, ByteBuffer data, boolean last) {
        System.out.println("📨 Deepgram binary data received (" + data.remaining() + " bytes)");
        
        // Forward binary data from Deepgram to frontend (shouldn't happen for STT, but just in case)
        try {
            byte[] bytes = new byte[data.remaining()];
            data.get(bytes);
            if (frontendSession.isOpen()) {
                frontendSession.sendMessage(new org.springframework.web.socket.BinaryMessage(bytes));
            }
        } catch (IOException e) {
            System.err.println("❌ Error sending binary to frontend: " + e.getMessage());
        }
        
        // CRITICAL: Request more data
        webSocket.request(1);
        
        return CompletableFuture.completedFuture(null);
    }
    
    @Override
    public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
        System.out.println("❌ Deepgram WebSocket closed - code: " + statusCode + ", reason: " + reason);
        isConnected = false;
        
        // Close frontend connection as well
        try {
            if (frontendSession.isOpen()) {
                frontendSession.close(new CloseStatus(statusCode, reason));
            }
        } catch (IOException e) {
            System.err.println("❌ Error closing frontend session: " + e.getMessage());
        }
        
        return CompletableFuture.completedFuture(null);
    }
    
    @Override
    public void onError(WebSocket webSocket, Throwable error) {
        System.err.println("❌ Deepgram WebSocket error: " + error.getMessage());
        error.printStackTrace();
        isConnected = false;
        
        // Close frontend connection
        try {
            if (frontendSession.isOpen()) {
                frontendSession.close(CloseStatus.SERVER_ERROR.withReason(error.getMessage()));
            }
        } catch (IOException e) {
            System.err.println("❌ Error closing frontend session: " + e.getMessage());
        }
    }
}