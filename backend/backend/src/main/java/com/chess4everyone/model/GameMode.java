package com.chess4everyone.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "game_modes")
public class GameMode {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String name; // BULLET, BLITZ, RAPID, CLASSICAL, etc.

    @Column(nullable = false, length = 100)
    private String displayName; // "Bullet", "Blitz", "Rapid", "Classical"

    @Column(length = 255)
    private String description;

    @Column(nullable = false)
    private Integer minTimeMinutes; // Minimum game duration in minutes

    @Column(nullable = false)
    private Integer maxTimeMinutes; // Maximum game duration in minutes

    @Column(nullable = false)
    private Integer incrementSeconds; // Increment seconds (default 0)

    @Column(length = 50)
    private String icon; // Emoji icon for UI display

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    /**
     * Determines if a given time control (minutes + increment) matches this game mode
     * @param totalMinutes - minutes portion of time control
     * @param increment - increment in seconds
     * @return true if this time control falls within the mode's range
     */
    public boolean matches(int totalMinutes, int increment) {
        return totalMinutes >= minTimeMinutes && 
               totalMinutes <= maxTimeMinutes &&
               (incrementSeconds == 0 || increment == incrementSeconds);
    }

    /**
     * Parses time control string like "10+0" or "5+3" and returns minutes
     * @param timeControl - time control string in format "minutes+increment"
     * @return total minutes
     */
    public static int parseTimeMinutes(String timeControl) {
        if (timeControl == null || timeControl.isEmpty()) {
            return 0;
        }
        try {
            String[] parts = timeControl.split("\\+");
            return Integer.parseInt(parts[0]);
        } catch (Exception e) {
            return 0;
        }
    }

    /**
     * Parses time control string and returns increment in seconds
     * @param timeControl - time control string in format "minutes+increment"
     * @return increment in seconds
     */
    public static int parseIncrement(String timeControl) {
        if (timeControl == null || timeControl.isEmpty()) {
            return 0;
        }
        try {
            String[] parts = timeControl.split("\\+");
            return parts.length > 1 ? Integer.parseInt(parts[1]) : 0;
        } catch (Exception e) {
            return 0;
        }
    }
}
