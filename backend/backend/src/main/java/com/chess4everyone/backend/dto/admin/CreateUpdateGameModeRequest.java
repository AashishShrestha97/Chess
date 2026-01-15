package com.chess4everyone.backend.dto.admin;

public record CreateUpdateGameModeRequest(
    String name,
    String displayName,
    String description,
    Integer minTimeMinutes,
    Integer maxTimeMinutes,
    Integer incrementSeconds,
    String icon
) {}
