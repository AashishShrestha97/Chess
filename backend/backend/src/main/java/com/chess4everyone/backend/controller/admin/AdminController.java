package com.chess4everyone.backend.controller.admin;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.chess4everyone.backend.dto.admin.CreateUpdateGameModeRequest;
import com.chess4everyone.backend.dto.admin.CreateUpdateUserRequest;
import com.chess4everyone.backend.dto.admin.CreateUpdateVoiceCommandRequest;
import com.chess4everyone.backend.dto.admin.GameModeDto;
import com.chess4everyone.backend.dto.admin.UserManagementDto;
import com.chess4everyone.backend.dto.admin.VoiceCommandDto;
import com.chess4everyone.backend.service.admin.AdminGameModeService;
import com.chess4everyone.backend.service.admin.AdminUserService;
import com.chess4everyone.backend.service.admin.AdminVoiceCommandService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {
    
    private final AdminUserService adminUserService;
    private final AdminVoiceCommandService adminVoiceCommandService;
    private final AdminGameModeService adminGameModeService;
    
    // ============================================================================
    // USER MANAGEMENT ENDPOINTS
    // ============================================================================
    
    /**
     * Get all users for admin dashboard
     */
    @GetMapping("/users")
    public ResponseEntity<List<UserManagementDto>> getAllUsers() {
        log.info("📊 Admin fetching all users");
        List<UserManagementDto> users = adminUserService.getAllUsers();
        return ResponseEntity.ok(users);
    }
    
    /**
     * Get single user details
     */
    @GetMapping("/users/{userId}")
    public ResponseEntity<UserManagementDto> getUser(@PathVariable Long userId) {
        log.info("🔍 Admin fetching user: {}", userId);
        UserManagementDto user = adminUserService.getUserById(userId);
        return ResponseEntity.ok(user);
    }
    
    /**
     * Update user by admin
     */
    @PutMapping("/users/{userId}")
    public ResponseEntity<UserManagementDto> updateUser(
            @PathVariable Long userId,
            @RequestBody CreateUpdateUserRequest request) {
        log.info("✏️ Admin updating user: {}", userId);
        UserManagementDto updated = adminUserService.updateUser(userId, request);
        return ResponseEntity.ok(updated);
    }
    
    /**
     * Delete user by admin
     */
    @DeleteMapping("/users/{userId}")
    public ResponseEntity<?> deleteUser(@PathVariable Long userId) {
        log.warn("🗑️ Admin deleting user: {}", userId);
        adminUserService.deleteUser(userId);
        return ResponseEntity.ok("User deleted successfully");
    }
    
    /**
     * Toggle user enabled/disabled status
     */
    @PatchMapping("/users/{userId}/toggle-status")
    public ResponseEntity<UserManagementDto> toggleUserStatus(@PathVariable Long userId) {
        log.info("🔄 Admin toggling user status: {}", userId);
        UserManagementDto updated = adminUserService.toggleUserStatus(userId);
        return ResponseEntity.ok(updated);
    }
    
    // ============================================================================
    // VOICE COMMAND MANAGEMENT ENDPOINTS
    // ============================================================================
    
    /**
     * Get all voice commands
     */
    @GetMapping("/voice-commands")
    public ResponseEntity<List<VoiceCommandDto>> getAllVoiceCommands() {
        log.info("📋 Admin fetching all voice commands");
        List<VoiceCommandDto> commands = adminVoiceCommandService.getAllVoiceCommands();
        return ResponseEntity.ok(commands);
    }
    
    /**
     * Get active voice commands only
     */
    @GetMapping("/voice-commands/active")
    public ResponseEntity<List<VoiceCommandDto>> getActiveVoiceCommands() {
        log.info("📋 Admin fetching active voice commands");
        List<VoiceCommandDto> commands = adminVoiceCommandService.getActiveVoiceCommands();
        return ResponseEntity.ok(commands);
    }
    
    /**
     * Get voice commands by intent
     */
    @GetMapping("/voice-commands/intent/{intent}")
    public ResponseEntity<List<VoiceCommandDto>> getCommandsByIntent(@PathVariable String intent) {
        log.info("🔍 Admin fetching commands by intent: {}", intent);
        List<VoiceCommandDto> commands = adminVoiceCommandService.getCommandsByIntent(intent);
        return ResponseEntity.ok(commands);
    }
    
    /**
     * Create new voice command
     */
    @PostMapping("/voice-commands")
    public ResponseEntity<VoiceCommandDto> createVoiceCommand(
            @RequestBody CreateUpdateVoiceCommandRequest request) {
        log.info("➕ Admin creating voice command: {}", request.commandName());
        VoiceCommandDto created = adminVoiceCommandService.createVoiceCommand(request);
        return ResponseEntity.ok(created);
    }
    
    /**
     * Update voice command
     */
    @PutMapping("/voice-commands/{commandId}")
    public ResponseEntity<VoiceCommandDto> updateVoiceCommand(
            @PathVariable Long commandId,
            @RequestBody CreateUpdateVoiceCommandRequest request) {
        log.info("✏️ Admin updating voice command: {}", commandId);
        VoiceCommandDto updated = adminVoiceCommandService.updateVoiceCommand(commandId, request);
        return ResponseEntity.ok(updated);
    }
    
    /**
     * Delete voice command
     */
    @DeleteMapping("/voice-commands/{commandId}")
    public ResponseEntity<?> deleteVoiceCommand(@PathVariable Long commandId) {
        log.warn("🗑️ Admin deleting voice command: {}", commandId);
        adminVoiceCommandService.deleteVoiceCommand(commandId);
        return ResponseEntity.ok("Voice command deleted successfully");
    }
    
    /**
     * Toggle voice command active status
     */
    @PatchMapping("/voice-commands/{commandId}/toggle-status")
    public ResponseEntity<VoiceCommandDto> toggleVoiceCommandStatus(@PathVariable Long commandId) {
        log.info("🔄 Admin toggling voice command status: {}", commandId);
        VoiceCommandDto updated = adminVoiceCommandService.toggleVoiceCommandStatus(commandId);
        return ResponseEntity.ok(updated);
    }
    
    // ============================================================================
    // GAME MODE MANAGEMENT ENDPOINTS
    // ============================================================================
    
    /**
     * Get all game modes
     */
    @GetMapping("/game-modes")
    public ResponseEntity<List<GameModeDto>> getAllGameModes() {
        log.info("📋 Admin fetching all game modes");
        List<GameModeDto> modes = adminGameModeService.getAllGameModes();
        return ResponseEntity.ok(modes);
    }
    
    /**
     * Get single game mode
     */
    @GetMapping("/game-modes/{gameModeId}")
    public ResponseEntity<GameModeDto> getGameMode(@PathVariable Long gameModeId) {
        log.info("🔍 Admin fetching game mode: {}", gameModeId);
        GameModeDto mode = adminGameModeService.getGameModeById(gameModeId);
        return ResponseEntity.ok(mode);
    }
    
    /**
     * Create new game mode
     */
    @PostMapping("/game-modes")
    public ResponseEntity<GameModeDto> createGameMode(
            @RequestBody CreateUpdateGameModeRequest request) {
        log.info("➕ Admin creating game mode: {}", request.name());
        GameModeDto created = adminGameModeService.createGameMode(request);
        return ResponseEntity.ok(created);
    }
    
    /**
     * Update game mode
     */
    @PutMapping("/game-modes/{gameModeId}")
    public ResponseEntity<GameModeDto> updateGameMode(
            @PathVariable Long gameModeId,
            @RequestBody CreateUpdateGameModeRequest request) {
        log.info("✏️ Admin updating game mode: {}", gameModeId);
        GameModeDto updated = adminGameModeService.updateGameMode(gameModeId, request);
        return ResponseEntity.ok(updated);
    }
    
    /**
     * Delete game mode
     */
    @DeleteMapping("/game-modes/{gameModeId}")
    public ResponseEntity<?> deleteGameMode(@PathVariable Long gameModeId) {
        log.warn("🗑️ Admin deleting game mode: {}", gameModeId);
        adminGameModeService.deleteGameMode(gameModeId);
        return ResponseEntity.ok("Game mode deleted successfully");
    }
}
