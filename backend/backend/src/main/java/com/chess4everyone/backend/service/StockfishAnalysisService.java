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
 * Provides Chess.com-style analysis with real-time evaluation bars
 */
@Service
public class StockfishAnalysisService {

    private final GameAnalysisRepository analysisRepository;
    private final ObjectMapper objectMapper;
    
    // Path to Stockfish executable - adjust based on your system
    private static final String STOCKFISH_PATH = "stockfish"; // Assumes stockfish is in PATH
    private static final int ANALYSIS_DEPTH = 22;
    private static final int MAX_ANALYSIS_TIME_MS = 5000; // 5 seconds per position

    public StockfishAnalysisService(GameAnalysisRepository analysisRepository) {
        this.analysisRepository = analysisRepository;
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Analyze a completed game with Chess.com-style classification
     */
    public void analyzeGame(Game game) {
        System.out.println("🔬 Analyzing game: " + game.getId());
        
        try {
            if (game.getPgn() == null || game.getPgn().isEmpty()) {
                System.out.println("⚠️ No PGN data, skipping analysis");
                System.out.println("   Game ID: " + game.getId());
                System.out.println("   PGN: " + game.getPgn());
                System.out.println("   MovesJson: " + (game.getMovesJson() != null ? "Present" : "NULL"));
                return;
            }

            System.out.println("📄 PGN length: " + game.getPgn().length() + " characters");

            // Check if Stockfish is available
            try {
                ProcessBuilder testPb = new ProcessBuilder(STOCKFISH_PATH, "--version");
                testPb.start().waitFor(2, java.util.concurrent.TimeUnit.SECONDS);
                System.out.println("✅ Stockfish is available");
            } catch (Exception e) {
                System.err.println("❌ Stockfish not found in PATH. Install Stockfish to enable game analysis.");
                System.err.println("   You can download it from: https://stockfishchess.org/download/");
                System.err.println("   Or on Windows: choco install stockfish, or add stockfish.exe to your PATH");
                return;
            }

            System.out.println("✅ Creating GameAnalysis object...");
            GameAnalysis analysis = new GameAnalysis();
            System.out.println("✅ GameAnalysis created");
            
            System.out.println("✅ Setting game on analysis...");
            analysis.setGame(game);
            System.out.println("✅ Game set on analysis");

            // Parse moves from PGN
            System.out.println("🔄 Starting move analysis...");
            List<MoveAnalysis> movesAnalysisList = null;
            try {
                movesAnalysisList = analyzeMoves(game.getPgn());
                System.out.println("📊 Completed move analysis");
            } catch (Exception e) {
                System.err.println("❌ Failed during move analysis: " + e.getMessage());
                e.printStackTrace();
                return;
            }

            if (movesAnalysisList.isEmpty()) {
                System.out.println("⚠️ No moves to analyze");
                return;
            }

            System.out.println("📊 Analyzed " + movesAnalysisList.size() + " moves");

            // Calculate accuracy scores (Chess.com style)
            System.out.println("🧮 Calculating accuracy scores...");
            double whiteAccuracy = calculateAccuracy(movesAnalysisList, true);
            double blackAccuracy = calculateAccuracy(movesAnalysisList, false);
            System.out.println("   White accuracy: " + String.format("%.1f%%", whiteAccuracy));
            System.out.println("   Black accuracy: " + String.format("%.1f%%", blackAccuracy));

            analysis.setWhiteAccuracy(whiteAccuracy);
            analysis.setBlackAccuracy(blackAccuracy);

            // Count mistakes and blunders
            System.out.println("📈 Counting mistakes and blunders...");
            int[] whiteStats = countMistakesAndBlunders(movesAnalysisList, true);
            int[] blackStats = countMistakesAndBlunders(movesAnalysisList, false);

            analysis.setWhiteMistakes(whiteStats[0]);
            analysis.setWhiteBlunders(whiteStats[1]);
            analysis.setBlackMistakes(blackStats[0]);
            analysis.setBlackBlunders(blackStats[1]);

            // Extract opening name
            System.out.println("📖 Extracting opening name...");
            String openingName = extractOpeningName(game.getPgn());
            analysis.setOpeningName(openingName != null ? openingName : "Unknown Opening");

            // Convert moves analysis to JSON
            System.out.println("💾 Converting to JSON...");
            analysis.setMovesAnalysis(objectMapper.writeValueAsString(movesAnalysisList));

            // Save analysis
            System.out.println("💿 Saving analysis to database...");
            analysisRepository.save(analysis);
            System.out.println("✅ Analysis saved for game: " + game.getId());
            System.out.println("   White accuracy: " + String.format("%.1f%%", whiteAccuracy));
            System.out.println("   Black accuracy: " + String.format("%.1f%%", blackAccuracy));

        } catch (Exception e) {
            System.err.println("❌ Error analyzing game: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * Analyze individual moves in the game with Chess.com-style classification
     * This method now properly handles PGN parsing and evaluation
     */
    private List<MoveAnalysis> analyzeMoves(String pgn) {
        List<MoveAnalysis> analysisResults = new ArrayList<>();
        
        try {
            List<String> moves = extractMovesFromPGN(pgn);

            if (moves.isEmpty()) {
                return analysisResults;
            }

            String fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"; // Starting position
            
            for (int i = 0; i < moves.size() && i < 150; i++) { // Limit to 150 half-moves
                String sanMove = moves.get(i);
                
                // Analyze position BEFORE the move
                Map<String, Object> beforeEval = analyzePosition(fen);
                double evalBefore = (Double) beforeEval.getOrDefault("eval", 0.0);
                String bestMoveBefore = (String) beforeEval.getOrDefault("bestmove", "");
                
                // Apply the move and get new FEN
                String newFen = applyMoveToFEN(fen, sanMove);
                
                if (newFen.equals(fen)) {
                    System.err.println("⚠️ Could not apply move: " + sanMove + " at move index " + i);
                    continue;
                }
                
                // Analyze position AFTER the move
                Map<String, Object> afterEval = analyzePosition(newFen);
                double evalAfter = (Double) afterEval.getOrDefault("eval", 0.0);
                String bestMoveAfter = (String) afterEval.getOrDefault("bestmove", "");
                
                MoveAnalysis ma = new MoveAnalysis();
                ma.moveNumber = (i / 2) + 1;
                ma.moveIndex = i;
                ma.san = sanMove;
                ma.evaluationBefore = evalBefore;
                ma.evaluationAfter = evalAfter;
                ma.evaluation = evalAfter; // Keep for backwards compatibility
                ma.bestMove = bestMoveAfter.isEmpty() ? bestMoveBefore : bestMoveAfter;
                
                // Calculate evaluation delta (from the player's perspective)
                // If it's Black's turn (odd index), flip the sign
                double evalDelta = evalAfter - evalBefore;
                if (i % 2 == 1) {
                    evalDelta = -evalDelta; // Black wants to minimize eval
                }
                
                // Classify the move based on evaluation delta and position evaluation
                classifyMove(ma, evalDelta, evalAfter);
                
                analysisResults.add(ma);
                fen = newFen;
            }
            
        } catch (Exception e) {
            System.err.println("❌ Error analyzing moves: " + e.getMessage());
            e.printStackTrace();
        }
        
        return analysisResults;
    }

    /**
     * Classify a move based on evaluation delta and position evaluation
     * Chess.com style classification with threshold-based approach
     */
    private void classifyMove(MoveAnalysis ma, double evalDelta, double positionEval) {
        // evalDelta is positive if the position got better for the player
        
        // Brilliant move: Makes a significant comeback move when losing (eval delta > 1.0)
        if (positionEval < -1.5 && evalDelta > 1.0) {
            ma.moveClass = "BRILLIANT";
            ma.isBrilliant = true;
        }
        // Excellent move: Significant improvement in balanced or winning position
        else if (evalDelta > 0.6) {
            ma.moveClass = "EXCELLENT";
            ma.isExcellent = true;
        }
        // Good move: Maintains or improves position moderately
        else if (evalDelta > 0.2 && evalDelta <= 0.6) {
            ma.moveClass = "GOOD";
            ma.isGood = true;
        }
        // OK/Book move: Move that doesn't change evaluation significantly
        else if (evalDelta >= -0.15 && evalDelta <= 0.2) {
            ma.moveClass = "OK";
            ma.isOk = true;
        }
        // Inaccuracy: Slight loss of evaluation (-0.5 to -0.15)
        else if (evalDelta >= -0.5 && evalDelta < -0.15) {
            ma.moveClass = "INACCURACY";
            ma.isInaccuracy = true;
        }
        // Mistake: Moderate loss of evaluation (-1.5 to -0.5)
        else if (evalDelta >= -1.5 && evalDelta < -0.5) {
            ma.moveClass = "MISTAKE";
            ma.isMistake = true;
        }
        // Blunder: Large loss of evaluation (< -1.5)
        else if (evalDelta < -1.5) {
            ma.moveClass = "BLUNDER";
            ma.isBlunder = true;
        }
        // Default to OK if no other classification
        else {
            ma.moveClass = "OK";
            ma.isOk = true;
        }
    }

    /**
     * Apply a move to a FEN position and return the new FEN
     * Uses the chess library approach for better compatibility
     */
    private String applyMoveToFEN(String fen, String sanMove) {
        try {
            // Try using Stockfish to apply the move
            ProcessBuilder pb = new ProcessBuilder(STOCKFISH_PATH);
            Process process = pb.start();
            
            PrintWriter writer = new PrintWriter(process.getOutputStream());
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            
            // Set the position
            writer.println("position fen " + fen);
            writer.println("d");
            writer.flush();
            
            // Read the current position
            String line;
            StringBuilder positionOutput = new StringBuilder();
            while ((line = reader.readLine()) != null) {
                positionOutput.append(line).append("\n");
                if (line.startsWith("Fen:")) {
                    break;
                }
            }
            
            // Get legal moves
            writer.println("moves");
            writer.flush();
            
            List<String> legalMoves = new ArrayList<>();
            String moveLine;
            while ((moveLine = reader.readLine()) != null) {
                if (moveLine.isEmpty()) break;
                for (String move : moveLine.split(" ")) {
                    if (!move.isEmpty()) {
                        legalMoves.add(move);
                    }
                }
            }
            
            // Find matching move (SAN to UCI conversion)
            String uciMove = null;
            for (String legalMove : legalMoves) {
                // Try to match the SAN move with legal UCI moves
                if (matchSANtoUCI(sanMove, legalMove, fen)) {
                    uciMove = legalMove;
                    break;
                }
            }
            
            if (uciMove == null) {
                System.err.println("⚠️ Could not find legal move for SAN: " + sanMove);
                writer.println("quit");
                writer.close();
                process.waitFor();
                return fen;
            }
            
            // Apply the move
            writer.println("position fen " + fen + " moves " + uciMove);
            writer.println("d");
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
            
            // Extract new FEN
            String[] lines = output.toString().split("\n");
            for (String l : lines) {
                if (l.startsWith("Fen:")) {
                    String newFen = l.substring(4).trim();
                    return newFen;
                }
            }
            
            return fen;
            
        } catch (Exception e) {
            System.err.println("⚠️ Failed to apply move " + sanMove + ": " + e.getMessage());
            return fen;
        }
    }
    
    /**
     * Match SAN notation to UCI move
     * Basic heuristic matching
     */
    private boolean matchSANtoUCI(String san, String uci, String fen) {
        // Remove check/checkmate symbols from SAN
        String cleanSan = san.replace("+", "").replace("#", "").replace("!", "").replace("?", "");
        
        // Handle castling
        if (cleanSan.equals("O-O")) {
            return uci.equals("e1g1") || uci.equals("e8g8");
        }
        if (cleanSan.equals("O-O-O")) {
            return uci.equals("e1c1") || uci.equals("e8c8");
        }
        
        // Simple heuristic: check if SAN ends with destination square
        if (cleanSan.length() >= 2) {
            String destSquare = cleanSan.substring(cleanSan.length() - 2);
            if (uci.endsWith(destSquare)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Analyze a single position using Stockfish with multipv for better accuracy
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
            
            // Send initialization commands
            writer.println("setoption name MultiPV value 1");
            writer.println("setoption name Threads value 4");
            writer.flush();
            
            // Set position and analyze
            writer.println("position fen " + fen);
            writer.println("go depth " + ANALYSIS_DEPTH + " movetime " + MAX_ANALYSIS_TIME_MS);
            writer.flush();
            
            double bestEval = 0.0;
            String bestMove = "";
            
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("bestmove")) {
                    String[] parts = line.split(" ");
                    if (parts.length > 1) {
                        bestMove = parts[1];
                    }
                    break;
                }
                
                // Parse evaluation from info line
                if (line.startsWith("info") && line.contains("cp")) {
                    Pattern pattern = Pattern.compile("cp (-?\\d+)");
                    Matcher matcher = pattern.matcher(line);
                    if (matcher.find()) {
                        double eval = Double.parseDouble(matcher.group(1)) / 100.0; // Convert centipawns to pawns
                        bestEval = eval;
                    }
                }
                
                // Handle mate scores
                if (line.startsWith("info") && line.contains("mate")) {
                    Pattern pattern = Pattern.compile("mate (-?\\d+)");
                    Matcher matcher = pattern.matcher(line);
                    if (matcher.find()) {
                        int mateIn = Integer.parseInt(matcher.group(1));
                        // Represent mate as very large evaluation
                        bestEval = mateIn > 0 ? 100.0 : -100.0;
                    }
                }
            }
            
            result.put("eval", bestEval);
            result.put("bestmove", bestMove);
            
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
        
        return new int[]{mistakes, blunders};
    }

    /**
     * Extract opening name from PGN headers
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
     * Properly handles PGN format with headers and comments
     */
    private List<String> extractMovesFromPGN(String pgn) {
        List<String> moves = new ArrayList<>();
        
        // Remove PGN headers [...]
        String gameText = pgn.replaceAll("\\[.*?\\]", "");
        
        // Remove variations (parentheses and their content)
        gameText = gameText.replaceAll("\\(.*?\\)", "");
        
        // Remove comments {...}
        gameText = gameText.replaceAll("\\{.*?\\}", "");
        
        // Split by whitespace
        String[] tokens = gameText.trim().split("\\s+");
        
        for (String token : tokens) {
            if (token.isEmpty()) continue;
            
            // Skip move numbers (1., 2., etc)
            if (token.matches("\\d+[.]{1,3}")) continue;
            
            // Skip result markers if found
            if (token.matches("(1-0|0-1|1/2-1/2|\\*)")) continue;
            
            // Valid move patterns in algebraic notation
            if (token.matches("^[a-hNBRQK]?[a-h]?[1-8]?x?[a-h][1-8](=[NBRQ])?[\\+#!?]*$")) {
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
