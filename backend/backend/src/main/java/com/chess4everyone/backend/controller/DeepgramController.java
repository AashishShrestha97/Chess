package com.chess4everyone.backend.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.chess4everyone.backend.service.DeepgramService;

@RestController
@RequestMapping("/api/deepgram")
@CrossOrigin(origins = "*")
public class DeepgramController {
    
    @Autowired
    private DeepgramService deepgramService;
    
    /**
     * Generate temporary token for frontend WebSocket connection
     * This is more secure than exposing API key to frontend
     */
    @GetMapping("/token")
    public ResponseEntity<Map<String, String>> getToken() {
        try {
            String token = deepgramService.generateTemporaryToken();
            Map<String, String> response = new HashMap<>();
            response.put("token", token);
            response.put("expiresIn", "3600"); // 1 hour
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    /**
     * Convert speech to text (for fallback or non-streaming use)
     */
    @PostMapping("/transcribe")
    public ResponseEntity<Map<String, Object>> transcribe(@RequestParam("audio") MultipartFile audioFile) {
        try {
            Map<String, Object> result = deepgramService.transcribeAudio(audioFile);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    /**
     * Convert text to speech
     */
    @PostMapping(value = "/speak", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public ResponseEntity<byte[]> speak(@RequestBody Map<String, String> request) {
        try {
            String text = request.get("text");
            String voice = request.getOrDefault("voice", "aura-asteria-en");
            
            byte[] audioData = deepgramService.textToSpeech(text, voice);
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .header("Content-Disposition", "attachment; filename=speech.mp3")
                    .body(audioData);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
    
    /**
     * Get available voice models
     */
    @GetMapping("/voices")
    public ResponseEntity<Map<String, Object>> getVoices() {
        Map<String, Object> voices = new HashMap<>();
        voices.put("voices", new String[]{
            "aura-asteria-en",  // Female, warm and friendly
            "aura-luna-en",     // Female, expressive
            "aura-stella-en",   // Female, professional
            "aura-athena-en",   // Female, clear and natural
            "aura-hera-en",     // Female, confident
            "aura-orion-en",    // Male, deep and authoritative
            "aura-arcas-en",    // Male, natural
            "aura-perseus-en",  // Male, energetic
            "aura-angus-en",    // Male, conversational
            "aura-orpheus-en"   // Male, storytelling
        });
        return ResponseEntity.ok(voices);
    }
}