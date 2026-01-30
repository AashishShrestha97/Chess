package com.chess4everyone.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Health status response from ML API
 * Used to verify ML server is available and models are loaded
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MLHealthResponse {
    private String status;
    
    @JsonProperty("stockfish_available")
    private Boolean stockfishAvailable;
    
    @JsonProperty("classifier_ready")
    private Boolean classifierReady;
    
    private String timestamp;
    
    private String version;
}
