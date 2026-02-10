package com.chess4everyone.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Predictions container from ML API
 * Contains predictions for all chess categories analyzed by trained models
 * 
 * Categories:
 * - opening: Performance in opening phase (first 12 moves)
 * - middlegame: Performance in middlegame phase (complex positions)
 * - endgame: Performance in endgame phase (few pieces remaining)
 * - strategy: Strategic decision-making and positional understanding
 * - tactical: Tactical vision and tactical move finding
 * - timeManagement: Time management and decision-making under time pressure
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MLPredictions {
    private MLCategoryPrediction opening;
    private MLCategoryPrediction middlegame;
    private MLCategoryPrediction endgame;
    
    @JsonProperty("positional")
    private MLCategoryPrediction strategy;
    
    private MLCategoryPrediction tactical;
    
    @JsonProperty("time_management")
    private MLCategoryPrediction timeManagement;
}
