package com.chess4everyone.backend.dto;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response from Python ML API
 * Contains comprehensive player analysis with predictions, strengths, and weaknesses
 * 
 * This represents analysis of a player's games using trained ML models:
 * - opening_model.pkl
 * - middlegame_model.pkl  
 * - endgame_model.pkl
 * - strategy_model.pkl
 * - tactics_model.pkl
 * - time_management_model.pkl
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MLAnalysisResponse {
    @JsonProperty("user_id")
    private String userId;
    
    private String timestamp;
    
    @JsonProperty("games_analyzed")
    private Integer gamesAnalyzed;
    
    private MLPredictions predictions;
    
    private List<String> strengths;
    
    private List<String> weaknesses;
    
    private Map<String, Double> features;
    
    private String recommendation;
}
