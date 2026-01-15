package com.chess4everyone.backend.dto.admin;

import java.util.List;

public record VoiceCommandDto(
    Long id,
    String commandName,
    List<String> patterns,
    String intent,
    String description,
    Boolean active,
    String createdAt,
    String updatedAt
) {}
