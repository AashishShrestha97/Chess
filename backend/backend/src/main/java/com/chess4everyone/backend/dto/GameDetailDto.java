package com.chess4everyone.backend.dto;

import java.util.List;

public record GameDetailDto(
    Long id,
    String opponentName,
    String result,
    String gameType,
    String timeControl,
    String pgn,
    String movesJson,
    Integer moveCount,
    Long totalTimeWhiteMs,
    Long totalTimeBlackMs,
    Integer whiteRating,
    Integer blackRating,
    Integer ratingChange,
    Integer accuracyPercentage,
    String terminationReason,
    String playedAt
) {}
