package com.chess4everyone.backend.dto;

import java.util.Optional;

import com.fasterxml.jackson.annotation.JsonProperty;

public record UserGamesAnalysisDto(
    String displayName,
    String email,
    String phone,
    Integer totalGames,
    Integer wins,
    Integer losses,
    Integer draws,
    @JsonProperty("winRate")
    Double winRate,
    @JsonProperty("analysisData")
    Optional<AnalysisResultDto> analysisData,
    @JsonProperty("lastAnalysisDate")
    Optional<String> lastAnalysisDate
) {}
