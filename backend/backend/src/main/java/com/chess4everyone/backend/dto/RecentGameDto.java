package com.chess4everyone.backend.dto;

public record RecentGameDto(
    Long id,
    String opponentName,
    String result,
    Integer ratingChange,
    Integer accuracyPercentage,
    String timeAgo
) {}