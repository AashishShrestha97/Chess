package com.chess4everyone.backend.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request sent to Python ML API for player analysis
 * Matches the format expected by FastAPI inference server
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MLAnalysisRequest {
    private String user_id;      // User ID as string
    private String player_name;  // Player name/username
    private List<MLGameData> games;  // List of PGN games (1-20)
}
