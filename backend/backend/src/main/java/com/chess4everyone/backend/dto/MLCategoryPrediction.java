package com.chess4everyone.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Category prediction from ML model
 * Represents performance in a specific chess aspect (opening, middlegame, etc.)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MLCategoryPrediction {
    private String classification;  // "strong", "average", or "weak"
    private Double confidence;      // Confidence level 0.0-1.0
    
    @JsonProperty("numeric_score")
    private Integer numericScore;   // 0=weak, 1=average, 2=strong
}
