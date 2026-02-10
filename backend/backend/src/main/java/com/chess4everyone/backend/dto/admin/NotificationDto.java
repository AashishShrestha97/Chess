package com.chess4everyone.backend.dto.admin;

public record NotificationDto(
    Long id,
    String title,
    String message,
    String payload,
    String type,
    Boolean isRead,
    String createdAt
) {}
