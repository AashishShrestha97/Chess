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
     * Generate temporary token for frontend
     * For production, implement proper token generation with expiry
     */
    public String generateTemporaryToken() {
        // For now, return the API key
        // In production, use Deepgram's token API to create temporary tokens
        return config.getApiKey();
    }
    
    /**
     * Transcribe audio file to text
     */
    public Map<String, Object> transcribeAudio(MultipartFile audioFile) throws IOException, InterruptedException {
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
        } else {
            throw new RuntimeException("Deepgram API error: " + response.statusCode() + " - " + response.body());
        }
    }
    
    /**
     * Convert text to speech
     */
    public byte[] textToSpeech(String text, String voice) throws IOException, InterruptedException {
        Map<String, String> requestBody = new HashMap<>();
        requestBody.put("text", text);
        
        String jsonBody = objectMapper.writeValueAsString(requestBody);
        
        System.out.println("🔊 TTS Request - Text: " + text.substring(0, Math.min(50, text.length())));
        System.out.println("🔊 TTS Request - Voice: " + voice);
        System.out.println("🔊 TTS Request - API Key exists: " + (config.getApiKey() != null && !config.getApiKey().isEmpty()));
        System.out.println("🔊 TTS Endpoint: " + config.getTtsEndpoint());
        
        // IMPORTANT: Do NOT include sample_rate for MP3 encoding
        // Deepgram doesn't support sample_rate parameter with MP3 encoding
        String fullUrl = config.getTtsEndpoint() + 
            "?model=" + voice +
            "&encoding=mp3";
        
        System.out.println("🔊 TTS Full URL: " + fullUrl);
        
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(fullUrl))
                .header("Authorization", "Token " + config.getApiKey())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .timeout(Duration.ofSeconds(30))
                .build();
        
        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        
        System.out.println("🔊 TTS Response Status: " + response.statusCode());
        System.out.println("🔊 TTS Response Body Size: " + response.body().length + " bytes");
        
        if (response.statusCode() == 200) {
            return response.body();
        } else {
            String errorBody = new String(response.body());
            System.out.println("🔊 TTS Error Response: " + errorBody);
            System.out.println("🔊 TTS Error Status: " + response.statusCode());
            throw new RuntimeException("Deepgram TTS error: " + response.statusCode() + " - " + errorBody);
        }
    }
}