package com.chess4everyone.backend.dto;

public record SaveGameRequest(
    String opponentName,
    String result, // "WIN", "LOSS", "DRAW"
    String pgn,
    String movesJson,
    Integer whiteRating,
    Integer blackRating,
    String timeControl,
    String gameType, // "STANDARD", "VOICE"
    String terminationReason,
    Integer moveCount,
    Long totalTimeWhiteMs,
    Long totalTimeBlackMs,
    Integer accuracyPercentage,
    Long whitePlayerId,
    Long blackPlayerId,
    String openingName
) {}
