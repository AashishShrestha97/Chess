package com.chess4everyone.backend.service.admin;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.chess4everyone.backend.dto.admin.CreateUpdateUserRequest;
import com.chess4everyone.backend.dto.admin.UserManagementDto;
import com.chess4everyone.backend.entity.Role;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.repo.RoleRepository;
import com.chess4everyone.backend.repo.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminUserService {
    
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    
    /**
     * Get all users for admin dashboard
     */
    public List<UserManagementDto> getAllUsers() {
        log.debug("📋 Fetching all users for admin");
        return userRepository.findAll().stream()
            .map(this::convertToDto)
            .collect(Collectors.toList());
    }
    
    /**
     * Get single user by ID
     */
    public UserManagementDto getUserById(Long userId) {
        log.debug("🔍 Fetching user with ID: {}", userId);
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        return convertToDto(user);
    }
    
    /**
     * Update user details
     */
    @Transactional
    public UserManagementDto updateUser(Long userId, CreateUpdateUserRequest request) {
        log.info("✏️ Updating user ID: {}", userId);
        
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        
        user.setName(request.name());
        user.setEmail(request.email());
        user.setPhone(request.phone());
        user.setEnabled(request.enabled());
        
        // Update roles
        if (request.roles() != null && !request.roles().isEmpty()) {
            var roles = request.roles().stream()
                .map(roleName -> roleRepository.findByName(roleName)
                    .orElseThrow(() -> new RuntimeException("Role not found: " + roleName)))
                .collect(Collectors.toSet());
            user.setRoles(roles);
        }
        
        User updated = userRepository.save(user);
        log.info("✅ User updated: {}", userId);
        return convertToDto(updated);
    }
    
    /**
     * Delete user by ID
     */
    @Transactional
    public void deleteUser(Long userId) {
        log.warn("🗑️ Deleting user ID: {}", userId);
        
        if (!userRepository.existsById(userId)) {
            throw new RuntimeException("User not found");
        }
        
        userRepository.deleteById(userId);
        log.warn("✅ User deleted: {}", userId);
    }
    
    /**
     * Enable/Disable user
     */
    @Transactional
    public UserManagementDto toggleUserStatus(Long userId) {
        log.info("🔄 Toggling user status for ID: {}", userId);
        
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        
        user.setEnabled(!user.isEnabled());
        User updated = userRepository.save(user);
        
        log.info("✅ User status toggled: {} -> {}", userId, updated.isEnabled());
        return convertToDto(updated);
    }
    
    /**
     * Convert User entity to UserManagementDto
     */
    private UserManagementDto convertToDto(User user) {
        return new UserManagementDto(
            user.getId(),
            user.getName(),
            user.getEmail(),
            user.getPhone(),
            user.getRoles().stream()
                .map(Role::getName)
                .collect(Collectors.toSet()),
            user.isEnabled(),
            user.getCreatedAt().toString()
        );
    }
}
