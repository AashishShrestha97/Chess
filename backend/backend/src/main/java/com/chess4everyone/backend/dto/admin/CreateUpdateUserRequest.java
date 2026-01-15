package com.chess4everyone.backend.dto.admin;

import java.util.List;

public record CreateUpdateUserRequest(
    String name,
    String email,
    String phone,
    Boolean enabled,
    List<String> roles
) {}
