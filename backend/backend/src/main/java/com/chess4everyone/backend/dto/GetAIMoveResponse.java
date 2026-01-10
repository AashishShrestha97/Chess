package com.chess4everyone.backend.dto;

/**
 * Response with AI move suggestion and evaluation
 */
public record GetAIMoveResponse(
    String move,
    Double evaluation,
    String alternativeMove,
    Double alternativeEvaluation,
    String bestContinuation // PV line suggestion
) {}
