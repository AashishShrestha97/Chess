package com.chess4everyone.backend.controller;

import java.io.IOException;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.chess4everyone.backend.service.DeepgramService;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/deepgram")
// ✅ REMOVED @CrossOrigin - using global CORS config instead
public class DeepgramController {

    private final DeepgramService deepgramService;

    public DeepgramController(DeepgramService deepgramService) {
        this.deepgramService = deepgramService;
    }

    /**
     * ✅ ESSENTIAL: Get API token for frontend WebSocket STT
     */
    @GetMapping("/token")
<<<<<<< HEAD
    public ResponseEntity<?> getToken(HttpServletRequest httpRequest) {
        try {
            logCookies(httpRequest);
            
=======
    public ResponseEntity<?> getToken() {
        try {
>>>>>>> 9e3eafa (some changes)
            String apiKey = deepgramService.getApiKey();
            System.out.println("✅ API token requested and provided");
            return ResponseEntity.ok(Map.of("token", apiKey));
        } catch (Exception e) {
            System.err.println("❌ Error getting token: " + e.getMessage());
            return ResponseEntity.status(500)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * ✅ ESSENTIAL: Text-to-Speech (WAV format at 16kHz for optimized file size)
     */
    @PostMapping(value = "/speak", produces = "audio/wav")
<<<<<<< HEAD
    public ResponseEntity<?> speak(@RequestBody Map<String, String> request, HttpServletRequest httpRequest) {
=======
    public ResponseEntity<?> speak(@RequestBody Map<String, String> request) {
>>>>>>> 9e3eafa (some changes)
        try {
            logCookies(httpRequest);
            
            String text = request.get("text");
            String voice = request.getOrDefault("voice", "aura-asteria-en");
            
            System.out.println("🔊 TTS endpoint called - Text: " + 
                             (text != null ? text.substring(0, Math.min(50, text.length())) : "null"));
<<<<<<< HEAD
            System.out.println("🎤 Voice requested: " + voice);
=======
>>>>>>> 9e3eafa (some changes)
            
            if (text == null || text.trim().isEmpty()) {
                System.err.println("❌ TTS error: Text is required");
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Text is required"));
            }
            
            byte[] audioData = deepgramService.textToSpeech(text, voice);
            
            System.out.println("✅ TTS response sent - Size: " + audioData.length + " bytes");
            
            return ResponseEntity.ok()
<<<<<<< HEAD
                    .contentType(MediaType.valueOf("audio/wav"))
=======
                    .contentType(MediaType.valueOf("audio/wav"))  // ✅ WAV format
>>>>>>> 9e3eafa (some changes)
                    .header("Cache-Control", "public, max-age=3600")
                    .body(audioData);
                    
        } catch (IOException | InterruptedException e) {
            System.err.println("❌ TTS error: " + e.getClass().getName() + " - " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500)
                    .body(Map.of("error", "TTS generation failed: " + e.getMessage()));
        } catch (Exception e) {
            System.err.println("❌ Unexpected TTS error: " + e.getClass().getName() + " - " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500)
                    .body(Map.of("error", "Unexpected error: " + e.getMessage()));
<<<<<<< HEAD
        }
    }

    /**
     * ✅ NICE-TO-HAVE: List available voices
     */
    @GetMapping("/voices")
    public ResponseEntity<?> getVoices(HttpServletRequest httpRequest) {
        logCookies(httpRequest);
        
        return ResponseEntity.ok(Map.of("voices", new String[]{
                "aura-asteria-en",   // Default - American female
                "aura-luna-en",      // Warm female
                "aura-stella-en",    // Friendly female
                "aura-athena-en",    // Professional female
                "aura-hera-en",      // British female
                "aura-orion-en",     // Deep male
                "aura-arcas-en",     // American male
                "aura-perseus-en",   // Confident male
                "aura-angus-en",     // Irish male
                "aura-orpheus-en"    // British male
        }));
    }

    /**
     * ✅ ESSENTIAL: Health check
     */
    @GetMapping("/health")
    public ResponseEntity<?> health() {
        try {
            boolean healthy = deepgramService.isHealthy();
            return ResponseEntity.ok(Map.of(
                    "status", healthy ? "healthy" : "degraded",
                    "service", "deepgram"
            ));
        } catch (Exception e) {
            return ResponseEntity.status(503)
                    .body(Map.of(
                            "status", "unhealthy",
                            "service", "deepgram",
                            "error", e.getMessage()
                    ));
=======
>>>>>>> 9e3eafa (some changes)
        }
    }

    /**
<<<<<<< HEAD
     * Helper method to log cookies for debugging
     */
    private void logCookies(HttpServletRequest httpRequest) {
        if (httpRequest.getCookies() != null) {
            System.out.println("🍪 Cookies present: " + httpRequest.getCookies().length);
            for (Cookie cookie : httpRequest.getCookies()) {
                System.out.println("  - " + cookie.getName() + " = " + 
                    (cookie.getName().startsWith("ch4e_") ? "[TOKEN]" : cookie.getValue()));
            }
        } else {
            System.out.println("⚠️ No cookies in request");
=======
     * ✅ NICE-TO-HAVE: List available voices
     */
    @GetMapping("/voices")
    public ResponseEntity<?> getVoices() {
        return ResponseEntity.ok(Map.of("voices", new String[]{
                "aura-asteria-en",   // Default - American female
                "aura-luna-en",      // Warm female
                "aura-stella-en",    // Friendly female
                "aura-athena-en",    // Professional female
                "aura-hera-en",      // British female
                "aura-orion-en",     // Deep male
                "aura-arcas-en",     // American male
                "aura-perseus-en",   // Confident male
                "aura-angus-en",     // Irish male
                "aura-orpheus-en"    // British male
        }));
    }

    /**
     * ✅ ESSENTIAL: Health check
     */
    @GetMapping("/health")
    public ResponseEntity<?> health() {
        try {
            boolean healthy = deepgramService.isHealthy();
            return ResponseEntity.ok(Map.of(
                    "status", healthy ? "healthy" : "degraded",
                    "service", "deepgram"
            ));
        } catch (Exception e) {
            return ResponseEntity.status(503)
                    .body(Map.of(
                            "status", "unhealthy",
                            "service", "deepgram",
                            "error", e.getMessage()
                    ));
>>>>>>> 9e3eafa (some changes)
        }
    }
}