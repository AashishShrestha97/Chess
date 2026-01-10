package com.chess4everyone.backend.service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

import com.chess4everyone.backend.entity.Game;
import com.chess4everyone.backend.entity.GameAnalysis;
import com.chess4everyone.backend.repository.GameAnalysisRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Service to analyze chess games using Stockfish engine
 */
@Service
public class StockfishAnalysisService {

    private final GameAnalysisRepository analysisRepository;
    private final ObjectMapper objectMapper;
    
    // Path to Stockfish executable - adjust based on your system
    private static final String STOCKFISH_PATH = "stockfish"; // Assumes stockfish is in PATH
    private static final int ANALYSIS_DEPTH = 20;
    private static final int MAX_ANALYSIS_TIME_MS = 3000; // 3 seconds per position

    public StockfishAnalysisService(GameAnalysisRepository analysisRepository) {
        this.analysisRepository = analysisRepository;
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Analyze a completed game
     */
    public void analyzeGame(Game game) {
        System.out.println("🔬 Analyzing game: " + game.getId());
        
        try {
            if (game.getPgn() == null || game.getPgn().isEmpty()) {
                System.out.println("⚠️ No PGN data, skipping analysis");
                return;
            }

            GameAnalysis analysis = new GameAnalysis();
            analysis.setGame(game);

            // Parse moves from JSON or PGN
            List<MoveAnalysis> movesAnalysisList = analyzeMoves(game);

            // Calculate accuracy scores
            double whiteAccuracy = calculateAccuracy(movesAnalysisList, true);
            double blackAccuracy = calculateAccuracy(movesAnalysisList, false);

            analysis.setWhiteAccuracy(whiteAccuracy);
            analysis.setBlackAccuracy(blackAccuracy);

            // Count mistakes and blunders
            int[] whiteStats = countMistakesAndBlunders(movesAnalysisList, true);
            int[] blackStats = countMistakesAndBlunders(movesAnalysisList, false);

            analysis.setWhiteMistakes(whiteStats[0]);
            analysis.setWhiteBlunders(whiteStats[1]);
            analysis.setBlackMistakes(blackStats[0]);
            analysis.setBlackBlunders(blackStats[1]);

            // Extract opening name
            String openingName = extractOpeningName(game.getPgn());
            analysis.setOpeningName(openingName != null ? openingName : "Unknown");

            // Convert moves analysis to JSON
            analysis.setMovesAnalysis(objectMapper.writeValueAsString(movesAnalysisList));

            // Save analysis
            analysisRepository.save(analysis);
            System.out.println("✅ Analysis saved for game: " + game.getId());

        } catch (Exception e) {
            System.err.println("❌ Error analyzing game: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * Analyze individual moves in the game with Chess.com-style classification
     */
    private List<MoveAnalysis> analyzeMoves(Game game) {
        List<MoveAnalysis> analysisResults = new ArrayList<>();
        
        try {
            String pgn = game.getPgn();
            List<String> moves = extractMovesFromPGN(pgn);

            String fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"; // Starting position
            
            for (int i = 0; i < moves.size() && i < 100; i++) { // Limit to 100 moves to avoid excessive analysis
                String move = moves.get(i);
                
                // Analyze position BEFORE the move
                Map<String, Object> beforeEval = analyzePosition(fen);
                double evalBefore = (Double) beforeEval.getOrDefault("eval", 0.0);
                
                // Apply the move to get new position
                String newFen = applyMoveToFEN(fen, move);
                
                // Analyze position AFTER the move
                Map<String, Object> afterEval = analyzePosition(newFen);
                double evalAfter = (Double) afterEval.getOrDefault("eval", 0.0);
                String bestMove = (String) afterEval.getOrDefault("bestmove", "");
                
                MoveAnalysis ma = new MoveAnalysis();
                ma.moveNumber = (i / 2) + 1;
                ma.moveIndex = i;
                ma.san = move;
                ma.evaluationBefore = evalBefore;
                ma.evaluationAfter = evalAfter;
                ma.evaluation = evalAfter; // Keep for backwards compatibility
                ma.bestMove = bestMove;
                
                // Calculate evaluation delta (from the player's perspective)
                // If it's Black's turn (odd index), flip the sign
                double evalDelta = evalAfter - evalBefore;
                if (i % 2 == 1) {
                    evalDelta = -evalDelta; // Black wants to minimize eval
                }
                
                // Classify the move based on evaluation delta
                classifyMove(ma, evalDelta, Math.abs(evalAfter));
                
                analysisResults.add(ma);
                fen = newFen;
            }
            
        } catch (Exception e) {
            System.err.println("❌ Error analyzing moves: " + e.getMessage());
        }
        
        return analysisResults;
    }

    /**
     * Classify a move based on evaluation delta and position evaluation
     * Chess.com style classification
     */
    private void classifyMove(MoveAnalysis ma, double evalDelta, double positionEval) {
        // evalDelta is positive if the position got better for the player
        
        // Brilliant move: Move that improves position significantly when losing
        if (positionEval < -2.0 && evalDelta > 0.5) {
            ma.moveClass = "BRILLIANT";
            ma.isBrilliant = true;
        }
        // Excellent move: Move that improves position significantly in balanced position
        else if (positionEval >= -2.0 && positionEval <= 2.0 && evalDelta > 0.5) {
            ma.moveClass = "EXCELLENT";
            ma.isExcellent = true;
        }
        // Good move: Move that maintains or slightly improves position
        else if (evalDelta > 0.1 && evalDelta <= 0.5) {
            ma.moveClass = "GOOD";
            ma.isGood = true;
        }
        // OK/Book move: Move that doesn't change evaluation much
        else if (evalDelta >= -0.1 && evalDelta <= 0.1) {
            ma.moveClass = "OK";
            ma.isOk = true;
        }
        // Inaccuracy: Slight loss of evaluation
        else if (evalDelta >= -0.3 && evalDelta < -0.1) {
            ma.moveClass = "INACCURACY";
            ma.isInaccuracy = true;
        }
        // Mistake: Moderate loss of evaluation
        else if (evalDelta >= -1.0 && evalDelta < -0.3) {
            ma.moveClass = "MISTAKE";
            ma.isMistake = true;
        }
        // Blunder: Large loss of evaluation
        else if (evalDelta < -1.0) {
            ma.moveClass = "BLUNDER";
            ma.isBlunder = true;
        }
    }

    /**
     * Apply a move to a FEN position and return the new FEN
     * Converts SAN to UCI and uses Stockfish to apply
     */
    private String applyMoveToFEN(String fen, String sanMove) {
        try {
            // First, get the legal moves and find which one matches the SAN notation
            String uciMove = findUCIMoveFromSAN(fen, sanMove);
            
            if (uciMove == null || uciMove.isEmpty()) {
                System.err.println("⚠️ Could not convert SAN move to UCI: " + sanMove);
                return fen; // Return original FEN if conversion fails
            }
            
            ProcessBuilder pb = new ProcessBuilder(STOCKFISH_PATH);
            Process process = pb.start();
            
            PrintWriter writer = new PrintWriter(process.getOutputStream());
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            
            // Use Stockfish position command with moves to apply
            writer.println("position fen " + fen);
            writer.println("go depth 1 movetime 100"); // Just to generate the position
            writer.flush();
            
            // Read until ready
            String line;
            while ((line = reader.readLine()) != null && !line.startsWith("bestmove")) {
                // Read output
            }
            
            // Now apply the move
            writer.println("position fen " + fen + " moves " + uciMove);
            writer.println("d"); // Display board
            writer.flush();
            
            StringBuilder output = new StringBuilder();
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
                if (line.startsWith("Checkers:")) {
                    break;
                }
            }
            
            writer.println("quit");
            writer.close();
            process.waitFor();
            
            // Parse the FEN from output
            String[] lines = output.toString().split("\n");
            for (String l : lines) {
                if (l.startsWith("Fen:")) {
                    String newFen = l.substring(4).trim();
                    System.out.println("✅ Applied move " + sanMove + " (" + uciMove + ") -> FEN: " + newFen);
                    return newFen;
                }
            }
            
            return fen;
            
        } catch (Exception e) {
            System.err.println("⚠️ Failed to apply move: " + e.getMessage());
            return fen;
        }
    }
    
    /**
     * Find UCI move representation from SAN notation
     * Uses Stockfish to parse the position and find legal moves
     */
    private String findUCIMoveFromSAN(String fen, String sanMove) {
        try {
            // The SAN to UCI conversion is complex
            // Simple approach: try to match common patterns
            // For e.g., "e4" -> likely "e2e4" or "e3e4"
            return simpleSANToUCI(sanMove, fen);
            
        } catch (Exception e) {
            System.err.println("⚠️ Failed to convert SAN: " + e.getMessage());
            return null;
        }
    }
    
    /**
     * Simple heuristic to convert SAN to UCI
     * This is a basic implementation - full SAN parsing is complex
     */
    private String simpleSANToUCI(String san, String baseFen) {
        san = san.trim();
        
        // Handle castling
        if (san.equals("O-O")) return "e1g1"; // Kingside castling (white) - simplified
        if (san.equals("O-O-O")) return "e1c1"; // Queenside castling (white) - simplified
        
        // Remove check and checkmate symbols
        san = san.replace("+", "").replace("#", "").replace("!", "").replace("?", "");
        
        // Simple square pattern matching (e.g., "e4", "Nf3", "Bxc5")
        Pattern pattern = Pattern.compile("[a-h][1-8]");
        Matcher matcher = pattern.matcher(san);
        
        if (matcher.find()) {
            String toSquare = matcher.group();
            
            // Look for "from" square or piece designation
            if (san.contains("x")) { // Capture
                // For now, return just the to square - system will need more logic
                return toSquare;
            }
            
            // For pawn moves
            if (Character.isLowerCase(san.charAt(0)) && san.charAt(0) >= 'a' && san.charAt(0) <= 'h') {
                // Pawn move
                return san; // Already in UCI format
            }
            
            // For piece moves, we need to find the piece and its from square
            // This requires analyzing the position - simplified for now
            return san; // Return as-is if it matches pattern
        }
        
        return san; // Return original if no pattern matches
    }

    /**
     * Analyze a single position using Stockfish
     */
    private Map<String, Object> analyzePosition(String fen) {
        Map<String, Object> result = new HashMap<>();
        result.put("eval", 0.0);
        result.put("bestmove", "");
        
        try {
            ProcessBuilder pb = new ProcessBuilder(STOCKFISH_PATH);
            Process process = pb.start();
            
            PrintWriter writer = new PrintWriter(process.getOutputStream());
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            
            // Send commands to Stockfish
            writer.println("position fen " + fen);
            writer.println("go depth " + ANALYSIS_DEPTH + " movetime " + MAX_ANALYSIS_TIME_MS);
            writer.flush();
            
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("bestmove")) {
                    String[] parts = line.split(" ");
                    if (parts.length > 1) {
                        result.put("bestmove", parts[1]);
                    }
                    break;
                }
                
                if (line.contains("cp ")) {
                    // Parse centipawn evaluation
                    Pattern pattern = Pattern.compile("cp (-?\\d+)");
                    Matcher matcher = pattern.matcher(line);
                    if (matcher.find()) {
                        double eval = Double.parseDouble(matcher.group(1)) / 100.0; // Convert to pawns
                        result.put("eval", eval);
                    }
                }
            }
            
            writer.println("quit");
            writer.close();
            process.waitFor();
            
        } catch (Exception e) {
            System.err.println("⚠️ Stockfish analysis failed (engine may not be installed): " + e.getMessage());
        }
        
        return result;
    }

    /**
     * Calculate accuracy percentage based on moves (Chess.com style)
     * Brilliant, Excellent, Good, and OK moves count as accurate
     * Inaccuracies, Mistakes, and Blunders count as inaccurate
     */
    private double calculateAccuracy(List<MoveAnalysis> moves, boolean isWhite) {
        List<MoveAnalysis> playerMoves = moves.stream()
            .filter(m -> (isWhite && m.moveIndex % 2 == 0) || (!isWhite && m.moveIndex % 2 == 1))
            .toList();
        
        if (playerMoves.isEmpty()) {
            return 100.0;
        }
        
        // Count accurate moves (brilliant, excellent, good, ok)
        long accurateMoves = playerMoves.stream()
            .filter(m -> m.isBrilliant || m.isExcellent || m.isGood || m.isOk)
            .count();
        
        return (accurateMoves * 100.0) / playerMoves.size();
    }

    /**
     * Count mistakes and blunders for a side (Chess.com style)
     */
    private int[] countMistakesAndBlunders(List<MoveAnalysis> moves, boolean isWhite) {
        List<MoveAnalysis> playerMoves = moves.stream()
            .filter(m -> (isWhite && m.moveIndex % 2 == 0) || (!isWhite && m.moveIndex % 2 == 1))
            .toList();
        
        int mistakes = (int) playerMoves.stream().filter(m -> m.isMistake).count();
        int blunders = (int) playerMoves.stream().filter(m -> m.isBlunder).count();
        
        // Return [mistakes, blunders] for backwards compatibility
        // Could be extended to return more data
        return new int[]{mistakes, blunders};
    }

    /**
     * Extract opening name from PGN
     */
    private String extractOpeningName(String pgn) {
        // Look for Opening tag
        Pattern pattern = Pattern.compile("\\[Opening \"([^\"]+)\"\\]");
        Matcher matcher = pattern.matcher(pgn);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
    }

    /**
     * Extract moves from PGN notation
     */
    private List<String> extractMovesFromPGN(String pgn) {
        List<String> moves = new ArrayList<>();
        
        // Remove headers and comments
        String gameText = pgn.replaceAll("\\[.*?\\]", "").replaceAll("\\{.*?\\}", "").trim();
        
        // Split by spaces and filter move-like strings
        Pattern movePattern = Pattern.compile("^[a-hO][a-h1-8O\\-=NBRQ+#]*$");
        String[] tokens = gameText.split("\\s+");
        
        for (String token : tokens) {
            // Skip move numbers and other non-move tokens
            if (!token.matches("\\d+[.\\.]{1,3}") && movePattern.matcher(token).matches()) {
                moves.add(token);
            }
        }
        
        return moves;
    }

    /**
     * Inner class to hold analysis for a single move
     */
    public static class MoveAnalysis {
        public int moveNumber;
        public int moveIndex;
        public String san; // algebraic notation
        public double evaluation; // Final evaluation (backwards compatibility)
        public double evaluationBefore; // Evaluation before the move
        public double evaluationAfter; // Evaluation after the move
        public String bestMove;
        public String moveClass; // BRILLIANT, EXCELLENT, GOOD, OK, INACCURACY, MISTAKE, BLUNDER
        
        // Classification flags (Chess.com style)
        public boolean isBrilliant = false;
        public boolean isExcellent = false;
        public boolean isGood = false;
        public boolean isOk = false;
        public boolean isInaccuracy = false;
        public boolean isMistake = false;
        public boolean isBlunder = false;
    }
}
