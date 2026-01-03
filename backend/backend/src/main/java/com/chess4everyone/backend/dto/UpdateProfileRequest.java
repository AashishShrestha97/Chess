package com.chess4everyone.backend.dto;

public record UpdateProfileRequest(
    String name,
    String phone
) {}
