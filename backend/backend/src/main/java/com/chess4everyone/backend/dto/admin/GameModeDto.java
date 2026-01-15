package com.chess4everyone.backend.dto.admin;

public record GameModeDto(
    Long id,
    String name,
    String displayName,
    String description,
    Integer minTimeMinutes,
    Integer maxTimeMinutes,
    Integer incrementSeconds,
    String icon,
    String createdAt
) {}
