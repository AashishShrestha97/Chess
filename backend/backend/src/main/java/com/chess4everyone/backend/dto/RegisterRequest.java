// dto/RegisterRequest.java
package com.chess4everyone.backend.dto;
import jakarta.validation.constraints.*;

public record RegisterRequest(
        @NotBlank String name,
        @Pattern(regexp="^[0-9+\\-()\\s]{7,20}$", message="Invalid phone") String phone,
        @Email @NotBlank String email,
        @Size(min=8, message="Min 8 chars") String password,
        @NotBlank String confirmPassword
) {}
