package com.chess4everyone.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record CategoryAnalysisDto(
    String classification, // "strong", "average", "weak"
    Double confidence,
    @JsonProperty("numericScore")
    Integer numericScore  // 0 = weak, 1 = average, 2 = strong
) {}
