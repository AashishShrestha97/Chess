package com.chess4everyone.backend.dto;

public record PredictionsDto(
    CategoryAnalysisDto opening,
    CategoryAnalysisDto middlegame,
    CategoryAnalysisDto endgame,
    CategoryAnalysisDto tactical,
    CategoryAnalysisDto positional,
    CategoryAnalysisDto timeManagement
) {}
