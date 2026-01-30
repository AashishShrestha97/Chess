package com.chess4everyone.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Data transfer object for a single game to send to ML API
 * Format required by Python FastAPI inference server
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MLGameData {
    private String pgn;  // PGN string of the chess game
}
