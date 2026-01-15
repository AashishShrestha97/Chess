package com.chess4everyone.backend.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "voice_commands")
public class VoiceCommand {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true)
    private String commandName; // e.g., "knight", "takes", "play", "castle"
    
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String patterns; // JSON array of voice patterns/variations
    
    @Column(nullable = false)
    private String intent; // e.g., "PIECE", "ACTION", "GAME_CONTROL", "TIME_CONTROL"
    
    @Column(columnDefinition = "TEXT")
    private String description; // Admin-facing description
    
    @Column(nullable = false)
    private Boolean active = true; // Can be disabled without deletion
    
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
