// dto/LoginRequest.java
package com.chess4everyone.backend.dto;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank String email,
        @NotBlank String password
) {}
