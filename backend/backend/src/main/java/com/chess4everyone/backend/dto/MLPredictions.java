package com.chess4everyone.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Predictions container from ML API
 * Contains predictions for all chess categories
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MLPredictions {
    private MLCategoryPrediction opening;
    private MLCategoryPrediction middlegame;
    private MLCategoryPrediction endgame;
    private MLCategoryPrediction tactical;
    private MLCategoryPrediction positional;
    
    @JsonProperty("time_management")
    private MLCategoryPrediction timeManagement;
}
