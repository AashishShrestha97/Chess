package com.chess4everyone.backend.service.admin;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.chess4everyone.backend.dto.admin.CreateUpdateGameModeRequest;
import com.chess4everyone.backend.dto.admin.GameModeDto;
import com.chess4everyone.backend.entity.GameMode;
import com.chess4everyone.backend.repository.GameModeRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminGameModeService {
    
    private final GameModeRepository gameModeRepository;
    
    /**
     * Get all game modes
     */
    public List<GameModeDto> getAllGameModes() {
        log.debug("📋 Fetching all game modes");
        return gameModeRepository.findAll().stream()
            .map(this::convertToDto)
            .collect(Collectors.toList());
    }
    
    /**
     * Get single game mode by ID
     */
    public GameModeDto getGameModeById(Long gameModeId) {
        log.debug("🔍 Fetching game mode with ID: {}", gameModeId);
        GameMode gameMode = gameModeRepository.findById(gameModeId)
            .orElseThrow(() -> new RuntimeException("Game mode not found"));
        return convertToDto(gameMode);
    }
    
    /**
     * Create new game mode
     */
    @Transactional
    public GameModeDto createGameMode(CreateUpdateGameModeRequest request) {
        log.info("➕ Creating game mode: {}", request.name());
        
        // Check if game mode already exists
        if (gameModeRepository.findByName(request.name()).isPresent()) {
            throw new RuntimeException("Game mode already exists: " + request.name());
        }
        
        GameMode gameMode = new GameMode();
        gameMode.setName(request.name());
        gameMode.setDisplayName(request.displayName());
        gameMode.setDescription(request.description());
        gameMode.setMinTimeMinutes(request.minTimeMinutes());
        gameMode.setMaxTimeMinutes(request.maxTimeMinutes());
        gameMode.setIncrementSeconds(request.incrementSeconds());
        gameMode.setIcon(request.icon());
        
        GameMode saved = gameModeRepository.save(gameMode);
        log.info("✅ Game mode created: {}", saved.getId());
        return convertToDto(saved);
    }
    
    /**
     * Update game mode
     */
    @Transactional
    public GameModeDto updateGameMode(Long gameModeId, CreateUpdateGameModeRequest request) {
        log.info("✏️ Updating game mode ID: {}", gameModeId);
        
        GameMode gameMode = gameModeRepository.findById(gameModeId)
            .orElseThrow(() -> new RuntimeException("Game mode not found"));
        
        // Check if new name already exists (if name is being changed)
        if (!gameMode.getName().equals(request.name())) {
            if (gameModeRepository.findByName(request.name()).isPresent()) {
                throw new RuntimeException("Game mode already exists: " + request.name());
            }
            gameMode.setName(request.name());
        }
        
        gameMode.setDisplayName(request.displayName());
        gameMode.setDescription(request.description());
        gameMode.setMinTimeMinutes(request.minTimeMinutes());
        gameMode.setMaxTimeMinutes(request.maxTimeMinutes());
        gameMode.setIncrementSeconds(request.incrementSeconds());
        gameMode.setIcon(request.icon());
        
        GameMode updated = gameModeRepository.save(gameMode);
        log.info("✅ Game mode updated: {}", gameModeId);
        return convertToDto(updated);
    }
    
    /**
     * Delete game mode
     */
    @Transactional
    public void deleteGameMode(Long gameModeId) {
        log.warn("🗑️ Deleting game mode ID: {}", gameModeId);
        
        if (!gameModeRepository.existsById(gameModeId)) {
            throw new RuntimeException("Game mode not found");
        }
        
        gameModeRepository.deleteById(gameModeId);
        log.warn("✅ Game mode deleted: {}", gameModeId);
    }
    
    /**
     * Convert GameMode entity to DTO
     */
    private GameModeDto convertToDto(GameMode gameMode) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        return new GameModeDto(
            gameMode.getId(),
            gameMode.getName(),
            gameMode.getDisplayName(),
            gameMode.getDescription(),
            gameMode.getMinTimeMinutes(),
            gameMode.getMaxTimeMinutes(),
            gameMode.getIncrementSeconds(),
            gameMode.getIcon(),
            gameMode.getCreatedAt().format(formatter)
        );
    }
}
