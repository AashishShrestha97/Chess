package com.chess4everyone.backend.service;

import com.chess4everyone.backend.entity.GameMode;
import com.chess4everyone.backend.repository.GameModeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class GameModeService {
    
    @Autowired
    private GameModeRepository gameModeRepository;
    
    /**
     * Find the appropriate GameMode for the given time control string
     * @param timeControl - e.g., "10+0", "5+3", "1+0"
     * @return Optional containing matching GameMode or empty
     */
    public Optional<GameMode> determineGameMode(String timeControl) {
        if (timeControl == null || timeControl.isEmpty()) {
            return Optional.empty();
        }
        
        try {
            int minutes = parseTimeMinutes(timeControl);
            int increment = parseIncrement(timeControl);
            
            // Get all game modes and find the best match
            List<GameMode> allModes = gameModeRepository.findAll();
            
            for (GameMode mode : allModes) {
                if (mode.matches(minutes, increment)) {
                    return Optional.of(mode);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        
        return Optional.empty();
    }
    
    /**
     * Determine game mode by minutes - fuzzy matching
     * @param minutes - total minutes for game
     * @return Optional containing closest matching GameMode
     */
    public Optional<GameMode> determineGameModeByMinutes(int minutes) {
        List<GameMode> allModes = gameModeRepository.findAll();
        
        // Find the mode with the closest matching range
        GameMode closest = null;
        int smallestDiff = Integer.MAX_VALUE;
        
        for (GameMode mode : allModes) {
            if (minutes >= mode.getMinTimeMinutes() && minutes <= mode.getMaxTimeMinutes()) {
                return Optional.of(mode); // Exact match
            }
            
            // Find closest range
            int midpoint = (mode.getMinTimeMinutes() + mode.getMaxTimeMinutes()) / 2;
            int diff = Math.abs(minutes - midpoint);
            if (diff < smallestDiff) {
                smallestDiff = diff;
                closest = mode;
            }
        }
        
        return closest != null ? Optional.of(closest) : Optional.empty();
    }
    
    /**
     * Get all available game modes
     * @return List of all game modes
     */
    public List<GameMode> getAllGameModes() {
        return gameModeRepository.findAll();
    }
    
    /**
     * Get game mode by name
     * @param name - e.g., "BULLET", "BLITZ", "RAPID", "CLASSICAL"
     * @return Optional containing GameMode or empty
     */
    public Optional<GameMode> getGameModeByName(String name) {
        return gameModeRepository.findByName(name);
    }
    
    /**
     * Parse time control string like "10+0" and extract minutes
     * @param timeControl - time control string
     * @return minutes
     */
    private int parseTimeMinutes(String timeControl) {
        try {
            String[] parts = timeControl.split("\\+");
            return Integer.parseInt(parts[0]);
        } catch (Exception e) {
            return 0;
        }
    }
    
    /**
     * Parse time control string and extract increment
     * @param timeControl - time control string
     * @return increment in seconds
     */
    private int parseIncrement(String timeControl) {
        try {
            String[] parts = timeControl.split("\\+");
            return parts.length > 1 ? Integer.parseInt(parts[1]) : 0;
        } catch (Exception e) {
            return 0;
        }
    }
}
