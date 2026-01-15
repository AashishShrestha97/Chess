package com.chess4everyone.backend.dto.admin;

import java.util.Set;

public record UserManagementDto(
    Long id,
    String name,
    String email,
    String phone,
    Set<String> roles,
    Boolean enabled,
    String createdAt
) {}
