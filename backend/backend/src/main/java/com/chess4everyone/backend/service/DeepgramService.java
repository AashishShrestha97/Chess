package com.chess4everyone.backend.service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.chess4everyone.backend.config.DeepgramConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class DeepgramService {
    
    @Autowired
    private DeepgramConfig config;
    
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    
    public DeepgramService() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        this.objectMapper = new ObjectMapper();
    }
    
    /**
     * Validate Deepgram API key
     */
    private void validateApiKey() throws IllegalStateException {
        String apiKey = config.getApiKey();
        
        if (apiKey == null || apiKey.isEmpty()) {
            throw new IllegalStateException("❌ Deepgram API key is not configured. " +
                "Please set 'deepgram.api.key' in application.properties");
        }
        
        if (apiKey.contains("YOUR_") || apiKey.contains("REPLACE")) {
            throw new IllegalStateException("❌ Deepgram API key is a placeholder. " +
                "Please replace with your actual API key from https://console.deepgram.com");
        }
        
        if (apiKey.length() < 30) {
            throw new IllegalStateException("❌ Deepgram API key appears invalid (too short). " +
                "Valid keys are typically 30-50 characters. Please check your API key.");
        }
        
        if (!apiKey.startsWith("dg_")) {
            System.out.println("⚠️ WARNING: API key does not start with 'dg_' - this may be invalid");
        }
    }
    
    /**
     * Generate temporary token for frontend
     * For production, implement proper token generation with expiry
     */
    public String generateTemporaryToken() {
        validateApiKey();
        // For now, return the API key
        // In production, use Deepgram's token API to create temporary tokens
        return config.getApiKey();
    }
    
    /**
     * Transcribe audio file to text
     */
    public Map<String, Object> transcribeAudio(MultipartFile audioFile) throws IOException, InterruptedException {
        validateApiKey();
        
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(config.getSttEndpoint() + 
                    "?model=nova-2" +
                    "&language=en-IN" +  // Indian English for better South Asian accent recognition
                    "&smart_format=true" +
                    "&punctuate=true" +
                    "&diarize=false"))
                .header("Authorization", "Token " + config.getApiKey())
                .header("Content-Type", "audio/wav")
                .POST(HttpRequest.BodyPublishers.ofByteArray(audioFile.getBytes()))
                .timeout(Duration.ofSeconds(30))
                .build();
        
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() == 200) {
            JsonNode jsonResponse = objectMapper.readTree(response.body());
            
            Map<String, Object> result = new HashMap<>();
            result.put("transcript", jsonResponse.path("results")
                    .path("channels").get(0)
                    .path("alternatives").get(0)
                    .path("transcript").asText());
            result.put("confidence", jsonResponse.path("results")
                    .path("channels").get(0)
                    .path("alternatives").get(0)
                    .path("confidence").asDouble());
            
            return result;
        } else if (response.statusCode() == 401) {
            throw new RuntimeException("❌ Deepgram API authentication failed (401). " +
                "Your API key is invalid or expired. Please check your API key at https://console.deepgram.com");
        } else {
            throw new RuntimeException("Deepgram API error: " + response.statusCode() + " - " + response.body());
        }
    }
    
    /**
     * Convert text to speech with enhanced error handling
     */
    public byte[] textToSpeech(String text, String voice) throws IOException, InterruptedException {
        // Validate API key first
        try {
            validateApiKey();
        } catch (IllegalStateException e) {
            System.err.println("❌ API Key Validation Failed: " + e.getMessage());
            throw new RuntimeException(e.getMessage(), e);
        }
        
        // Validate input
        if (text == null || text.trim().isEmpty()) {
            throw new IllegalArgumentException("Text parameter cannot be null or empty");
        }
        
        if (voice == null || voice.trim().isEmpty()) {
            voice = "aura-asteria-en"; // Default voice
        }
        
        Map<String, String> requestBody = new HashMap<>();
        requestBody.put("text", text);
        
        String jsonBody = objectMapper.writeValueAsString(requestBody);
        
        System.out.println("🔊 TTS Request - Text: " + text.substring(0, Math.min(50, text.length())));
        System.out.println("🔊 TTS Request - Voice: " + voice);
        System.out.println("🔊 TTS Request - API Key length: " + config.getApiKey().length() + " chars");
        System.out.println("🔊 TTS Endpoint: " + config.getTtsEndpoint());
        
        // Use WAV encoding instead of MP3 for better Web Audio API compatibility
        // WAV is uncompressed and works better with decodeAudioData()
        String fullUrl = config.getTtsEndpoint() + 
            "?model=" + voice +
            "&encoding=linear16" +
            "&sample_rate=48000" +  // Increased sample rate for better quality
            "&container=wav";
        
        System.out.println("🔊 TTS Full URL: " + fullUrl);
        
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(fullUrl))
                .header("Authorization", "Token " + config.getApiKey())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .timeout(Duration.ofSeconds(30))
                .build();
        
        try {
            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            
            System.out.println("🔊 TTS Response Status: " + response.statusCode());
            
            if (response.statusCode() == 200) {
                System.out.println("🔊 TTS Response Body Size: " + response.body().length + " bytes");
                return response.body();
            } else if (response.statusCode() == 401) {
                String errorBody = new String(response.body());
                System.err.println("❌ TTS Authentication Failed (401)");
                System.err.println("❌ Error Response: " + errorBody);
                throw new RuntimeException("❌ Deepgram API authentication failed (401). " +
                    "Your API key is invalid or expired. Please check your API key at https://console.deepgram.com");
            } else if (response.statusCode() == 400) {
                String errorBody = new String(response.body());
                System.err.println("❌ TTS Bad Request (400)");
                System.err.println("❌ Error Response: " + errorBody);
                throw new RuntimeException("❌ Bad request to Deepgram TTS API (400): " + errorBody);
            } else if (response.statusCode() == 429) {
                String errorBody = new String(response.body());
                System.err.println("❌ TTS Rate Limit Exceeded (429)");
                System.err.println("❌ Error Response: " + errorBody);
                throw new RuntimeException("❌ Deepgram API rate limit exceeded (429). Please wait and try again.");
            } else {
                String errorBody = new String(response.body());
                System.err.println("❌ TTS Error Response: " + errorBody);
                System.err.println("❌ TTS Error Status: " + response.statusCode());
                throw new RuntimeException("Deepgram TTS error: " + response.statusCode() + " - " + errorBody);
            }
        } catch (IOException | InterruptedException e) {
            System.err.println("❌ TTS Request Failed: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }
}