package com.chess4everyone.backend.dto;

/**
 * Request to get AI move suggestion
 */
public record GetAIMoveRequest(
    String fen,
    String difficulty // EASY, INTERMEDIATE, HARD, MASTER, IMPOSSIBLE
) {}
