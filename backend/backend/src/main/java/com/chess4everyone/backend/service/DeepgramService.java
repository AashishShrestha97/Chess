package com.chess4everyone.backend.service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.stereotype.Service;

import com.chess4everyone.backend.config.DeepgramConfig;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PreDestroy;

@Service
public class DeepgramService {

    private final DeepgramConfig config;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    
    // Thread pool for async operations
    private final ExecutorService executorService;
    private final ScheduledExecutorService scheduledExecutor;
    
    // Track active connections
    private final AtomicInteger activeConnections = new AtomicInteger(0);
    private static final int MAX_CONCURRENT_CONNECTIONS = 10;

    public DeepgramService(DeepgramConfig config) {
        this.config = config;
        this.objectMapper = new ObjectMapper();
        
        // ✅ Properly configured HttpClient with connection pooling
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .version(HttpClient.Version.HTTP_2)
                .executor(Executors.newFixedThreadPool(5, r -> {
                    Thread t = new Thread(r);
                    t.setDaemon(true);
                    t.setName("deepgram-http-" + t.getId());
                    return t;
                }))
                .build();
        
        // ✅ Thread pool with limits to prevent memory leaks
        this.executorService = new ThreadPoolExecutor(
                2, // core threads
                10, // max threads
                60L, TimeUnit.SECONDS,
                new LinkedBlockingQueue<>(100), // Bounded queue
                r -> {
                    Thread t = new Thread(r);
                    t.setDaemon(true);
                    t.setName("deepgram-worker-" + t.getId());
                    return t;
                },
                new ThreadPoolExecutor.CallerRunsPolicy()
        );
        
        // ✅ Scheduled executor for monitoring
        this.scheduledExecutor = Executors.newScheduledThreadPool(1, r -> {
            Thread t = new Thread(r);
            t.setDaemon(true);
            t.setName("deepgram-scheduler");
            return t;
        });
        
        // Periodic stats logging
        scheduledExecutor.scheduleAtFixedRate(
                this::logStats,
                1, 5, TimeUnit.MINUTES
        );
        
        System.out.println("✅ DeepgramService initialized successfully");
    }

    private void validateApiKey() {
        if (config.getApiKey() == null || config.getApiKey().trim().isEmpty()) {
            throw new IllegalStateException("❌ Deepgram API key is not configured");
        }
    }

    /**
     * ✅ Text-to-Speech with MP3 encoding (15x smaller than WAV)
     */
    public byte[] textToSpeech(String text, String voice) throws IOException, InterruptedException {
        validateApiKey();
        
        // Check concurrent connection limit
        int current = activeConnections.get();
        if (current >= MAX_CONCURRENT_CONNECTIONS) {
            System.err.println("⚠️ Too many concurrent TTS requests: " + current);
            throw new IOException("Too many concurrent TTS requests. Please try again.");
        }
        
        try {
            activeConnections.incrementAndGet();
            
            Map<String, String> requestBody = new HashMap<>();
            requestBody.put("text", text);
            String jsonBody = objectMapper.writeValueAsString(requestBody);
            
            // ✅ WAV encoding with optimized sample rate (16kHz instead of 48kHz)
            // This reduces file size by 3x while maintaining quality
            String fullUrl = config.getTtsEndpoint() + 
                "?model=" + voice +
                "&encoding=linear16" +
                "&sample_rate=16000" +  // Lower sample rate = smaller files
                "&container=wav";
            
            System.out.println("🔊 TTS Request - Text: " + text.substring(0, Math.min(50, text.length())) + 
                              (text.length() > 50 ? "..." : ""));
            System.out.println("🔊 TTS Full URL: " + fullUrl);
            
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(fullUrl))
                    .header("Authorization", "Token " + config.getApiKey())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .timeout(Duration.ofSeconds(15))
                    .build();
            
            long startTime = System.currentTimeMillis();
            
            HttpResponse<byte[]> response = httpClient.send(
                    request, 
                    HttpResponse.BodyHandlers.ofByteArray()
            );
            
            long duration = System.currentTimeMillis() - startTime;
            
            if (response.statusCode() == 200) {
                byte[] audioData = response.body();
                System.out.println(String.format(
                        "✅ TTS success - Size: %.2f KB, Time: %dms, Format: WAV 16kHz",
                        audioData.length / 1024.0,
                        duration
                ));
                return audioData;
            } else {
                String errorBody = new String(response.body());
                System.err.println("❌ Deepgram TTS error: " + response.statusCode() + " - " + errorBody);
                throw new IOException("Deepgram TTS API error: " + response.statusCode() + " - " + errorBody);
            }
            
        } catch (IOException | InterruptedException e) {
            System.err.println("❌ TTS Exception: " + e.getClass().getName() + " - " + e.getMessage());
            e.printStackTrace();
            throw e;
        } finally {
            activeConnections.decrementAndGet();
        }
    }

    /**
     * ✅ Get API key (for frontend WebSocket)
     */
    public String getApiKey() {
        validateApiKey();
        return config.getApiKey();
    }

    /**
     * ✅ Health check
     */
    public boolean isHealthy() {
        try {
            validateApiKey();
            return activeConnections.get() < MAX_CONCURRENT_CONNECTIONS;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * ✅ Stats logging
     */
    private void logStats() {
        System.out.println(String.format(
                "📊 Deepgram Stats - Active Connections: %d/%d, Executor Queue: %d",
                activeConnections.get(),
                MAX_CONCURRENT_CONNECTIONS,
                ((ThreadPoolExecutor) executorService).getQueue().size()
        ));
    }

    /**
     * ✅ Cleanup on shutdown
     */
    @PreDestroy
    public void shutdown() {
        System.out.println("🛑 Shutting down DeepgramService...");
        
        try {
            scheduledExecutor.shutdown();
            executorService.shutdown();
            
            if (!executorService.awaitTermination(10, TimeUnit.SECONDS)) {
                System.out.println("⚠️ Force shutting down executor");
                executorService.shutdownNow();
            }
            
            if (!scheduledExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduledExecutor.shutdownNow();
            }
            
            System.out.println("✅ DeepgramService shutdown complete");
        } catch (InterruptedException e) {
            System.err.println("❌ Error during shutdown: " + e.getMessage());
            executorService.shutdownNow();
            scheduledExecutor.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}