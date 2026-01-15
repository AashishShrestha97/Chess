package com.chess4everyone.backend.service.admin;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.chess4everyone.backend.dto.admin.CreateUpdateVoiceCommandRequest;
import com.chess4everyone.backend.dto.admin.VoiceCommandDto;
import com.chess4everyone.backend.entity.VoiceCommand;
import com.chess4everyone.backend.repository.VoiceCommandRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminVoiceCommandService {
    
    private final VoiceCommandRepository voiceCommandRepository;
    private final ObjectMapper objectMapper;
    
    /**
     * Get all voice commands
     */
    public List<VoiceCommandDto> getAllVoiceCommands() {
        log.debug("📋 Fetching all voice commands");
        return voiceCommandRepository.findAll().stream()
            .map(this::convertToDto)
            .collect(Collectors.toList());
    }
    
    /**
     * Get active voice commands only
     */
    public List<VoiceCommandDto> getActiveVoiceCommands() {
        log.debug("📋 Fetching active voice commands");
        return voiceCommandRepository.findByActiveTrue().stream()
            .map(this::convertToDto)
            .collect(Collectors.toList());
    }
    
    /**
     * Get voice commands by intent
     */
    public List<VoiceCommandDto> getCommandsByIntent(String intent) {
        log.debug("🔍 Fetching commands by intent: {}", intent);
        return voiceCommandRepository.findByIntent(intent).stream()
            .map(this::convertToDto)
            .collect(Collectors.toList());
    }
    
    /**
     * Create new voice command
     */
    @Transactional
    public VoiceCommandDto createVoiceCommand(CreateUpdateVoiceCommandRequest request) {
        log.info("➕ Creating voice command: {}", request.commandName());
        
        // Check if command already exists
        if (voiceCommandRepository.findByCommandName(request.commandName()).isPresent()) {
            throw new RuntimeException("Voice command already exists: " + request.commandName());
        }
        
        VoiceCommand command = new VoiceCommand();
        command.setCommandName(request.commandName());
        command.setPatterns(convertPatternsToJson(request.patterns()));
        command.setIntent(request.intent());
        command.setDescription(request.description());
        command.setActive(request.active() != null ? request.active() : true);
        
        VoiceCommand saved = voiceCommandRepository.save(command);
        log.info("✅ Voice command created: {}", saved.getId());
        return convertToDto(saved);
    }
    
    /**
     * Update voice command
     */
    @Transactional
    public VoiceCommandDto updateVoiceCommand(Long commandId, CreateUpdateVoiceCommandRequest request) {
        log.info("✏️ Updating voice command ID: {}", commandId);
        
        VoiceCommand command = voiceCommandRepository.findById(commandId)
            .orElseThrow(() -> new RuntimeException("Voice command not found"));
        
        // Check if new name already exists (if name is being changed)
        if (!command.getCommandName().equals(request.commandName())) {
            if (voiceCommandRepository.findByCommandName(request.commandName()).isPresent()) {
                throw new RuntimeException("Voice command already exists: " + request.commandName());
            }
            command.setCommandName(request.commandName());
        }
        
        command.setPatterns(convertPatternsToJson(request.patterns()));
        command.setIntent(request.intent());
        command.setDescription(request.description());
        command.setActive(request.active() != null ? request.active() : true);
        
        VoiceCommand updated = voiceCommandRepository.save(command);
        log.info("✅ Voice command updated: {}", commandId);
        return convertToDto(updated);
    }
    
    /**
     * Delete voice command
     */
    @Transactional
    public void deleteVoiceCommand(Long commandId) {
        log.warn("🗑️ Deleting voice command ID: {}", commandId);
        
        if (!voiceCommandRepository.existsById(commandId)) {
            throw new RuntimeException("Voice command not found");
        }
        
        voiceCommandRepository.deleteById(commandId);
        log.warn("✅ Voice command deleted: {}", commandId);
    }
    
    /**
     * Toggle voice command active status
     */
    @Transactional
    public VoiceCommandDto toggleVoiceCommandStatus(Long commandId) {
        log.info("🔄 Toggling voice command status ID: {}", commandId);
        
        VoiceCommand command = voiceCommandRepository.findById(commandId)
            .orElseThrow(() -> new RuntimeException("Voice command not found"));
        
        command.setActive(!command.getActive());
        VoiceCommand updated = voiceCommandRepository.save(command);
        
        log.info("✅ Voice command status toggled: {} -> {}", commandId, updated.getActive());
        return convertToDto(updated);
    }
    
    /**
     * Convert VoiceCommand entity to DTO
     */
    private VoiceCommandDto convertToDto(VoiceCommand command) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        return new VoiceCommandDto(
            command.getId(),
            command.getCommandName(),
            convertJsonToPatterns(command.getPatterns()),
            command.getIntent(),
            command.getDescription(),
            command.getActive(),
            command.getCreatedAt().format(formatter),
            command.getUpdatedAt().format(formatter)
        );
    }
    
    /**
     * Convert patterns list to JSON string
     */
    private String convertPatternsToJson(List<String> patterns) {
        try {
            return objectMapper.writeValueAsString(patterns);
        } catch (Exception e) {
            log.error("Error converting patterns to JSON", e);
            throw new RuntimeException("Error converting patterns to JSON");
        }
    }
    
    /**
     * Convert JSON string to patterns list
     */
    @SuppressWarnings("unchecked")
    private List<String> convertJsonToPatterns(String patternsJson) {
        try {
            return objectMapper.readValue(patternsJson, List.class);
        } catch (Exception e) {
            log.error("Error converting JSON to patterns", e);
            return List.of();
        }
    }
}
