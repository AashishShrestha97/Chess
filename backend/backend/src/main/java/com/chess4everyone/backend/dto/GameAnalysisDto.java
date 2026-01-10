package com.chess4everyone.backend.dto;

public record GameAnalysisDto(
    Long gameId,
    Double whiteAccuracy,
    Double blackAccuracy,
    Integer whiteBlunders,
    Integer blackBlunders,
    Integer whiteMistakes,
    Integer blackMistakes,
    String movesAnalysis, // JSON
    String bestMovesByPhase, // JSON
    String keyMoments, // JSON
    String openingName,
    Integer openingPly,
    Integer openingScoreWhite,
    Integer openingScoreBlack,
    Integer middlegameScoreWhite,
    Integer middlegameScoreBlack,
    Integer endgameScoreWhite,
    Integer endgameScoreBlack
) {}
