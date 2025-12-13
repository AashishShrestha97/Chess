package com.chess4everyone.backend.dto;

public record ProfileStatsDto(
    Long userId,
    String name,
    String username,
    Integer rating,
    Integer ratingChangeThisMonth,
    Long globalRank,
    Integer gamesPlayed,
    Double winRate,
    Integer currentStreak,
    Integer bestStreak,
    String timePlayed,
    String favoriteOpening,
    Integer wins,
    Integer draws,
    Integer losses
) {}