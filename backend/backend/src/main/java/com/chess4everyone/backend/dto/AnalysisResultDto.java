package com.chess4everyone.backend.dto;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AnalysisResultDto(
    String userId,
    String timestamp,
    @JsonProperty("gamesAnalyzed")
    Integer gamesAnalyzed,
    PredictionsDto predictions,
    List<String> strengths,
    List<String> weaknesses,
    Map<String, Double> features,
    String recommendation
) {}
