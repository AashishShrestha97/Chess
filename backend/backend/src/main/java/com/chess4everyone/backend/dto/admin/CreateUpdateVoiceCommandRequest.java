package com.chess4everyone.backend.dto.admin;

import java.util.List;

public record CreateUpdateVoiceCommandRequest(
    String commandName,
    List<String> patterns,
    String intent,
    String description,
    Boolean active
) {}
