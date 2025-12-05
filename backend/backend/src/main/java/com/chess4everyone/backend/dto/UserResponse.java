// dto/UserResponse.java
package com.chess4everyone.backend.dto;

public record UserResponse(Long id, String name, String email, String phone, String provider) {}
