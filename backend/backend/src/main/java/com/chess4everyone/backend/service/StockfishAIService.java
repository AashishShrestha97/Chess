package com.chess4everyone.backend.service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

/**
 * Service to provide strong AI opponent using Stockfish
 * Supports multiple difficulty levels
 */
@Service
public class StockfishAIService {
    
    private static final String STOCKFISH_PATH = "stockfish";
    private static final int[] DEPTH_BY_DIFFICULTY = {
        8,   // Easy
        14,  // Intermediate
        20,  // Hard
        25,  // Master
        30   // Impossible
    };
    
    // Skill level for Stockfish (0-20, where 0 is worst and 20 is best)
    private static final int[] SKILL_BY_DIFFICULTY = {
        5,   // Easy
        10,  // Intermediate
        15,  // Hard
        18,  // Master
        20   // Impossible
    };
    
    public enum Difficulty {
        EASY(0), INTERMEDIATE(1), HARD(2), MASTER(3), IMPOSSIBLE(4);
        
        private final int level;
        Difficulty(int level) { this.level = level; }
        public int getLevel() { return level; }
    }

    /**
     * Get best move for AI from given FEN position
     */
    public String getBestMove(String fen, Difficulty difficulty) {
        return getBestMove(fen, difficulty, 3000);
    }

    /**
     * Get best move with time limit in milliseconds
     */
    public String getBestMove(String fen, Difficulty difficulty, int timeLimitMs) {
        try {
            ProcessBuilder pb = new ProcessBuilder(STOCKFISH_PATH);
            Process process = pb.start();
            
            PrintWriter writer = new PrintWriter(process.getOutputStream());
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            
            // Configure Stockfish for the difficulty level
            int depth = DEPTH_BY_DIFFICULTY[difficulty.getLevel()];
            int skillLevel = SKILL_BY_DIFFICULTY[difficulty.getLevel()];
            
            // Set skill level (0-20) for varied play
            writer.println("setoption name Skill Level value " + skillLevel);
            writer.println("setoption name Threads value 4");
            writer.println("setoption name Hash value 256");
            writer.flush();
            
            // Set position and analyze
            writer.println("position fen " + fen);
            
            // Use both time and depth for accurate difficulty control
            String goCommand = String.format("go depth %d movetime %d", depth, timeLimitMs);
            writer.println(goCommand);
            writer.flush();
            
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
            }
            
            writer.println("quit");
            writer.close();
            process.waitFor();
            
            return bestMove;
            
        } catch (Exception e) {
            System.err.println("❌ Stockfish AI failed: " + e.getMessage());
            return "";
        }
    }

    /**
     * Get evaluation for a position
     */
    public double getPositionEvaluation(String fen, int depth) {
        try {
            ProcessBuilder pb = new ProcessBuilder(STOCKFISH_PATH);
            Process process = pb.start();
            
            PrintWriter writer = new PrintWriter(process.getOutputStream());
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            
            writer.println("position fen " + fen);
            writer.println("go depth " + depth + " movetime 3000");
            writer.flush();
            
            double evaluation = 0.0;
            String line;
            
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("bestmove")) {
                    break;
                }
                
                // Parse centipawn evaluation
                if (line.startsWith("info") && line.contains("cp")) {
                    Pattern pattern = Pattern.compile("cp (-?\\d+)");
                    Matcher matcher = pattern.matcher(line);
                    if (matcher.find()) {
                        evaluation = Double.parseDouble(matcher.group(1)) / 100.0;
                    }
                }
                
                // Handle mate scores
                if (line.startsWith("info") && line.contains("mate")) {
                    Pattern pattern = Pattern.compile("mate (-?\\d+)");
                    Matcher matcher = pattern.matcher(line);
                    if (matcher.find()) {
                        int mateIn = Integer.parseInt(matcher.group(1));
                        evaluation = mateIn > 0 ? 100.0 : -100.0;
                    }
                }
            }
            
            writer.println("quit");
            writer.close();
            process.waitFor();
            
            return evaluation;
            
        } catch (Exception e) {
            System.err.println("⚠️ Stockfish evaluation failed: " + e.getMessage());
            return 0.0;
        }
    }

    /**
     * Get all legal moves with evaluations for a position
     */
    public Map<String, Double> getLegalMovesWithEval(String fen, Difficulty difficulty) {
        Map<String, Double> movesWithEval = new HashMap<>();
        
        try {
            ProcessBuilder pb = new ProcessBuilder(STOCKFISH_PATH);
            Process process = pb.start();
            
            PrintWriter writer = new PrintWriter(process.getOutputStream());
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            
            // Use multipv to get multiple best moves
            writer.println("setoption name MultiPV value 10");
            writer.println("setoption name Threads value 4");
            writer.flush();
            
            writer.println("position fen " + fen);
            writer.println("go depth " + DEPTH_BY_DIFFICULTY[difficulty.getLevel()] + " movetime 5000");
            writer.flush();
            
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("bestmove")) {
                    break;
                }
                
                // Parse pv (principal variation) line
                if (line.contains("pv")) {
                    Pattern pattern = Pattern.compile("cp (-?\\d+)");
                    Matcher evalMatcher = pattern.matcher(line);
                    
                    if (evalMatcher.find()) {
                        double eval = Double.parseDouble(evalMatcher.group(1)) / 100.0;
                        
                        // Extract first move from pv
                        Pattern pvPattern = Pattern.compile("pv\\s+([a-h][1-8][a-h][1-8]\\w*)");
                        Matcher pvMatcher = pvPattern.matcher(line);
                        
                        if (pvMatcher.find()) {
                            String move = pvMatcher.group(1);
                            movesWithEval.put(move, eval);
                        }
                    }
                }
            }
            
            writer.println("quit");
            writer.close();
            process.waitFor();
            
        } catch (Exception e) {
            System.err.println("⚠️ Failed to get legal moves: " + e.getMessage());
        }
        
        return movesWithEval;
    }

    /**
     * Check if Stockfish is available
     */
    public boolean isStockfishAvailable() {
        try {
            ProcessBuilder pb = new ProcessBuilder(STOCKFISH_PATH);
            Process process = pb.start();
            
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            PrintWriter writer = new PrintWriter(process.getOutputStream());
            
            writer.println("quit");
            writer.flush();
            
            process.waitFor();
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
