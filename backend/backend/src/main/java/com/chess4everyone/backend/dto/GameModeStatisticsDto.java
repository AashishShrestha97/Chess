package com.chess4everyone.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for game mode statistics
 * Shows performance metrics for a specific game mode
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GameModeStatisticsDto {
    private String modeName;           // "BULLET", "BLITZ", "RAPID", "CLASSICAL"
    private String displayName;        // "Bullet", "Blitz", "Rapid", "Classical"
    private String icon;               // Emoji icon ⚡, 🔥, ⚔️, 👑
    private Long totalGames;           // Total games in this mode
    private Long wins;                 // Games won
    private Long losses;               // Games lost
    private Long draws;                // Games drawn
    private Double winRate;            // Win rate percentage
    private Double drawRate;           // Draw rate percentage
    private Double lossRate;           // Loss rate percentage
    private Integer averageAccuracy;   // Average accuracy %
    private Long totalTimeSpentMinutes; // Total time spent playing
    
    // Calculate rates
    public void calculateRates() {
        if (totalGames == 0) {
            winRate = 0.0;
            drawRate = 0.0;
            lossRate = 0.0;
        } else {
            winRate = (wins * 100.0) / totalGames;
            drawRate = (draws * 100.0) / totalGames;
            lossRate = (losses * 100.0) / totalGames;
        }
    }
}
