package com.chess4everyone.backend.dto;

public record PerformanceAreaDto(
    String name,
    Integer score,
    Integer change
) {}