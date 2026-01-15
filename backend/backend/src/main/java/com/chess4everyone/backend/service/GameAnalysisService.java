package com.chess4everyone.backend.service;

import java.time.Instant;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.chess4everyone.backend.dto.*;
import com.chess4everyone.backend.entity.Game;
import com.chess4everyone.backend.entity.User;
import com.chess4everyone.backend.entity.PlayerAnalysis;
import com.chess4everyone.backend.repository.GameRepository;
import com.chess4everyone.backend.repository.PlayerAnalysisRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Service for analyzing player's chess performance using AI models
 * Analyzes 10 most recent games to determine strengths/weaknesses
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GameAnalysisService {

    private final GameRepository gameRepository;
    private final PlayerAnalysisRepository playerAnalysisRepository;
    private final GameModeService gameModeService;
    private final ObjectMapper objectMapper;

    /**
     * Get user's game statistics and analysis
     * Returns basic stats and AI analysis if 10+ games are available
     */
    public UserGamesAnalysisDto getUserGamesAnalysis(User user) {
        List<Game> userGames = gameRepository.findByUserOrderByPlayedAtDesc(user);

        // Calculate basic statistics
        int totalGames = userGames.size();
        int wins = (int) userGames.stream()
                .filter(g -> "WIN".equals(g.getResult()))
                .count();
        int losses = (int) userGames.stream()
                .filter(g -> "LOSS".equals(g.getResult()))
                .count();
        int draws = (int) userGames.stream()
                .filter(g -> "DRAW".equals(g.getResult()))
                .count();
        double winRate = totalGames > 0 ? (wins * 100.0) / totalGames : 0.0;

        // Get cached analysis if available
        Optional<PlayerAnalysis> cachedAnalysis = playerAnalysisRepository
                .findByUser(user);

        Optional<AnalysisResultDto> analysisData = Optional.empty();
        Optional<String> lastAnalysisDate = Optional.empty();

        if (cachedAnalysis.isPresent() && totalGames >= 10) {
            try {
                PlayerAnalysis pa = cachedAnalysis.get();
                analysisData = Optional.of(parseAnalysisResult(pa));
                lastAnalysisDate = Optional.of(pa.getUpdatedAt().toString());
            } catch (Exception e) {
                log.error("Error parsing cached analysis: ", e);
            }
        }

        return new UserGamesAnalysisDto(
                user.getName(),
                user.getEmail(),
                user.getPhone() != null ? user.getPhone() : "",
                totalGames,
                wins,
                losses,
                draws,
                winRate,
                analysisData,
                lastAnalysisDate
        );
    }

    /**
     * Update player analysis with latest games
     * Requires at least 10 games
     */
    public UserGamesAnalysisDto updatePlayerAnalysis(User user) {
        List<Game> userGames = gameRepository.findByUserOrderByPlayedAtDesc(user);

        if (userGames.size() < 10) {
            throw new IllegalArgumentException("Need at least 10 games for analysis");
        }

        // Get 10 most recent games
        List<Game> recentGames = userGames.stream()
                .limit(10)
                .toList();

        // Simulate AI analysis (in production, call Python API)
        AnalysisResultDto analysisResult = generateAIAnalysis(user, recentGames);

        // Cache the analysis result
        PlayerAnalysis playerAnalysis = playerAnalysisRepository
                .findByUser(user)
                .orElse(new PlayerAnalysis());

        playerAnalysis.setUser(user);
        playerAnalysis.setGamesAnalyzed(recentGames.size());
        playerAnalysis.setAnalyzedAt(Instant.now());

        try {
            playerAnalysis.setStrengths(objectMapper.writeValueAsString(analysisResult.strengths()));
            playerAnalysis.setWeaknesses(objectMapper.writeValueAsString(analysisResult.weaknesses()));
            playerAnalysis.setMetrics(objectMapper.writeValueAsString(analysisResult.features()));
        } catch (Exception e) {
            log.error("Error serializing analysis: ", e);
        }

        playerAnalysisRepository.save(playerAnalysis);

        // Return updated game analysis
        return getUserGamesAnalysis(user);
    }

    /**
     * Generate AI-based analysis for player (mock implementation)
     * In production, this would call the Python AI API with Stockfish analysis
     */
    private AnalysisResultDto generateAIAnalysis(User user, List<Game> games) {
        // Calculate game statistics for analysis
        int wins = (int) games.stream()
                .filter(g -> "WIN".equals(g.getResult()))
                .count();
        int losses = (int) games.stream()
                .filter(g -> "LOSS".equals(g.getResult()))
                .count();

        // Simulate ML model predictions based on game patterns
        // In production: analyze actual game moves with Stockfish -> extract features -> run ML models
        Map<String, CategoryAnalysisDto> predictions = generateCategoryPredictions(games);

        List<String> strengths = determineStrengths(predictions);
        List<String> weaknesses = determineWeaknesses(predictions);

        Map<String, Double> features = calculateFeatures(games);

        String recommendation = generateRecommendation(strengths, weaknesses);

        return new AnalysisResultDto(
                String.valueOf(user.getId()),
                Instant.now().toString(),
                games.size(),
                new PredictionsDto(
                        predictions.get("opening"),
                        predictions.get("middlegame"),
                        predictions.get("endgame"),
                        predictions.get("tactical"),
                        predictions.get("positional"),
                        predictions.get("timeManagement")
                ),
                strengths,
                weaknesses,
                features,
                recommendation
        );
    }

    /**
     * Generate category predictions based on actual game data
     */
    private Map<String, CategoryAnalysisDto> generateCategoryPredictions(List<Game> games) {
        Map<String, CategoryAnalysisDto> predictions = new HashMap<>();

        // Analyze actual game data to determine performance in each category
        
        // Opening: evaluate early game performance (accuracy + wins in opening positions)
        double openingScore = analyzeOpening(games);
        predictions.put("opening", classifyPerformance(openingScore));
        
        // Middlegame: evaluate complex position handling
        double middlegameScore = analyzeMiddlegame(games);
        predictions.put("middlegame", classifyPerformance(middlegameScore));
        
        // Endgame: evaluate endgame efficiency and conversion
        double endgameScore = analyzeEndgame(games);
        predictions.put("endgame", classifyPerformance(endgameScore));
        
        // Tactical: evaluate tactical awareness (move accuracy + blunder rate)
        double tacticalScore = analyzeTactical(games);
        predictions.put("tactical", classifyPerformance(tacticalScore));
        
        // Positional: evaluate strategic understanding
        double positionalScore = analyzePositional(games);
        predictions.put("positional", classifyPerformance(positionalScore));
        
        // Time Management: evaluate performance under time pressure
        double timeManagementScore = analyzeTimeManagement(games);
        predictions.put("timeManagement", classifyPerformance(timeManagementScore));

        return predictions;
    }

    /**
     * Analyze opening phase performance from games
     */
    private double analyzeOpening(List<Game> games) {
        // Opening analysis based on:
        // - Win rate in games with standard openings
        // - Opening ECO/classification
        // - Accuracy in opening moves (first 10 moves)
        
        int openingWins = (int) games.stream()
                .filter(g -> "WIN".equals(g.getResult()) && g.getOpeningName() != null)
                .count();
        
        int totalWithOpening = (int) games.stream()
                .filter(g -> g.getOpeningName() != null)
                .count();
        
        double winRateInOpening = totalWithOpening > 0 ? (double) openingWins / totalWithOpening : 0.5;
        
        // Average accuracy in opening
        double avgAccuracy = games.stream()
                .filter(g -> g.getAccuracyPercentage() != null)
                .mapToInt(Game::getAccuracyPercentage)
                .average()
                .orElse(50.0) / 100.0;
        
        // Combined score: 70% win rate + 30% accuracy
        return (winRateInOpening * 0.7) + (avgAccuracy * 0.3);
    }

    /**
     * Analyze middlegame performance from games
     */
    private double analyzeMiddlegame(List<Game> games) {
        // Middlegame analysis based on:
        // - Win rate
        // - Average accuracy
        // - Rating change (positive = better middlegame)
        
        int middlegameWins = (int) games.stream()
                .filter(g -> "WIN".equals(g.getResult()))
                .count();
        
        double winRate = games.size() > 0 ? (double) middlegameWins / games.size() : 0.5;
        
        double avgAccuracy = games.stream()
                .filter(g -> g.getAccuracyPercentage() != null)
                .mapToInt(Game::getAccuracyPercentage)
                .average()
                .orElse(50.0) / 100.0;
        
        // Positive rating change indicates good middlegame play
        double avgRatingGain = games.stream()
                .filter(g -> g.getRatingChange() != null && g.getRatingChange() > 0)
                .mapToInt(Game::getRatingChange)
                .average()
                .orElse(0.0);
        
        double ratingScore = Math.min(1.0, (avgRatingGain + 20) / 40); // Normalize to 0-1
        
        // Combined: 50% win rate + 30% accuracy + 20% rating gain
        return (winRate * 0.5) + (avgAccuracy * 0.3) + (ratingScore * 0.2);
    }

    /**
     * Analyze endgame performance from games
     */
    private double analyzeEndgame(List<Game> games) {
        // Endgame analysis based on:
        // - Wins in games with high move counts (endgame reached)
        // - Conversion rate when winning
        // - Accuracy in long games
        
        List<Game> longGames = games.stream()
                .filter(g -> g.getMoveCount() != null && g.getMoveCount() >= 30)
                .toList();
        
        if (longGames.isEmpty()) {
            return 0.5; // Default if no long games
        }
        
        int endgameWins = (int) longGames.stream()
                .filter(g -> "WIN".equals(g.getResult()))
                .count();
        
        double conversionRate = (double) endgameWins / longGames.size();
        
        double avgAccuracy = longGames.stream()
                .filter(g -> g.getAccuracyPercentage() != null)
                .mapToInt(Game::getAccuracyPercentage)
                .average()
                .orElse(50.0) / 100.0;
        
        // Combined: 60% conversion rate + 40% accuracy
        return (conversionRate * 0.6) + (avgAccuracy * 0.4);
    }

    /**
     * Analyze tactical awareness from games
     */
    private double analyzeTactical(List<Game> games) {
        // Tactical analysis based on:
        // - Overall accuracy (high accuracy = good tactics)
        // - Win rate (tactical wins)
        // - Quick wins (checkmate in fewer moves = tactical strength)
        
        double avgAccuracy = games.stream()
                .filter(g -> g.getAccuracyPercentage() != null)
                .mapToInt(Game::getAccuracyPercentage)
                .average()
                .orElse(50.0) / 100.0;
        
        int tacticalWins = (int) games.stream()
                .filter(g -> "WIN".equals(g.getResult()))
                .count();
        
        double winRate = games.size() > 0 ? (double) tacticalWins / games.size() : 0.5;
        
        // Quick wins (move count < 25) indicate tactical strength
        long quickWins = games.stream()
                .filter(g -> "WIN".equals(g.getResult()) && g.getMoveCount() != null && g.getMoveCount() < 25)
                .count();
        
        double quickWinRate = games.size() > 0 ? (double) quickWins / games.size() : 0.0;
        
        // Combined: 40% accuracy + 40% win rate + 20% quick wins
        return (avgAccuracy * 0.4) + (winRate * 0.4) + (quickWinRate * 0.2);
    }

    /**
     * Analyze positional understanding from games
     */
    private double analyzePositional(List<Game> games) {
        // Positional analysis based on:
        // - Win rate (positional wins come from better position)
        // - Rating gain over time
        // - Accuracy in complex positions
        
        int positionalWins = (int) games.stream()
                .filter(g -> "WIN".equals(g.getResult()))
                .count();
        
        double winRate = games.size() > 0 ? (double) positionalWins / games.size() : 0.5;
        
        // Average rating change (positive = good positional understanding)
        double avgRatingChange = games.stream()
                .filter(g -> g.getRatingChange() != null)
                .mapToInt(Game::getRatingChange)
                .average()
                .orElse(0.0);
        
        double ratingScore = Math.min(1.0, Math.max(0.0, (avgRatingChange + 30) / 60)); // Normalize
        
        double avgAccuracy = games.stream()
                .filter(g -> g.getAccuracyPercentage() != null)
                .mapToInt(Game::getAccuracyPercentage)
                .average()
                .orElse(50.0) / 100.0;
        
        // Combined: 50% win rate + 30% rating change + 20% accuracy
        return (winRate * 0.5) + (ratingScore * 0.3) + (avgAccuracy * 0.2);
    }

    /**
     * Analyze time management performance
     */
    private double analyzeTimeManagement(List<Game> games) {
        // Time management based on:
        // - Win rate in blitz/rapid games (requires better time management)
        // - Accuracy under time pressure
        // - Avoidance of timeouts/quick losses
        
        // Separate rapid and blitz games
        List<Game> rapidBlitzGames = games.stream()
                .filter(g -> g.getTimeControl() != null && 
                        (g.getTimeControl().startsWith("3+") || 
                         g.getTimeControl().startsWith("5+") ||
                         g.getTimeControl().startsWith("10+") ||
                         g.getTimeControl().startsWith("1+")))
                .toList();
        
        double timeBasedWinRate = 0.5;
        if (!rapidBlitzGames.isEmpty()) {
            int timeWins = (int) rapidBlitzGames.stream()
                    .filter(g -> "WIN".equals(g.getResult()))
                    .count();
            timeBasedWinRate = (double) timeWins / rapidBlitzGames.size();
        }
        
        // Check for timeout losses (poor time management)
        long timeoutLosses = games.stream()
                .filter(g -> "LOSS".equals(g.getResult()) && 
                        g.getTerminationReason() != null &&
                        g.getTerminationReason().contains("TIMEOUT"))
                .count();
        
        double timeoutPenalty = games.size() > 0 ? 1.0 - ((double) timeoutLosses / games.size()) : 1.0;
        
        // Accuracy under time pressure
        double avgAccuracy = games.stream()
                .filter(g -> g.getAccuracyPercentage() != null)
                .mapToInt(Game::getAccuracyPercentage)
                .average()
                .orElse(50.0) / 100.0;
        
        // Combined: 50% time-based win rate + 30% timeout penalty + 20% accuracy
        return (timeBasedWinRate * 0.5) + (timeoutPenalty * 0.3) + (avgAccuracy * 0.2);
    }

    /**
     * Classify performance score into category analysis
     */
    private CategoryAnalysisDto classifyPerformance(double score) {
        // Normalize score to 0-1 range
        score = Math.max(0.0, Math.min(1.0, score));
        
        String classification;
        int numericScore;

        if (score >= 0.70) {
            classification = "strong";
            numericScore = 2;
        } else if (score >= 0.45) {
            classification = "average";
            numericScore = 1;
        } else {
            classification = "weak";
            numericScore = 0;
        }

        return new CategoryAnalysisDto(
                classification,
                Math.round(score * 100.0) / 100.0,
                numericScore
        );
    }

    /**
     * Determine strength areas from predictions
     */
    private List<String> determineStrengths(Map<String, CategoryAnalysisDto> predictions) {
        List<String> strengths = new ArrayList<>();

        predictions.forEach((category, analysis) -> {
            if ("strong".equals(analysis.classification())) {
                strengths.add(getCategoryLabel(category) + " - You demonstrate strong performance in this area");
            }
        });

        if (strengths.isEmpty()) {
            strengths.add("Focus on improving all aspects of your game for better results");
        }

        return strengths;
    }

    /**
     * Determine weakness areas from predictions
     */
    private List<String> determineWeaknesses(Map<String, CategoryAnalysisDto> predictions) {
        List<String> weaknesses = new ArrayList<>();

        predictions.forEach((category, analysis) -> {
            if ("weak".equals(analysis.classification())) {
                weaknesses.add(getCategoryLabel(category) + " - Work on improving this critical area");
            }
        });

        return weaknesses;
    }

    /**
     * Calculate feature metrics from games
     */
    private Map<String, Double> calculateFeatures(List<Game> games) {
        Map<String, Double> features = new HashMap<>();

        int wins = (int) games.stream()
                .filter(g -> "WIN".equals(g.getResult()))
                .count();
        int losses = (int) games.stream()
                .filter(g -> "LOSS".equals(g.getResult()))
                .count();
        int draws = games.size() - wins - losses;

        features.put("winRate", wins * 100.0 / games.size());
        features.put("averageRatingChange", games.stream()
                .mapToInt(g -> g.getRatingChange() != null ? g.getRatingChange() : 0)
                .average()
                .orElse(0.0));
        features.put("totalGames", (double) games.size());

        return features;
    }

    /**
     * Generate personalized recommendation
     */
    private String generateRecommendation(List<String> strengths, List<String> weaknesses) {
        if (weaknesses.isEmpty()) {
            return "Excellent work! You're performing well across all areas. Keep practicing to maintain your level.";
        }

        return "Focus on improving your " + (weaknesses.isEmpty() ? "overall game" : "weaknesses") + 
               ". Practice openings and endgames regularly, and analyze your losses to learn from mistakes.";
    }

    /**
     * Get human-readable category label
     */
    private String getCategoryLabel(String category) {
        return switch (category) {
            case "opening" -> "Opening";
            case "middlegame" -> "Middlegame";
            case "endgame" -> "Endgame";
            case "tactical" -> "Tactical Play";
            case "positional" -> "Positional Understanding";
            case "timeManagement" -> "Time Management";
            default -> category;
        };
    }

    /**
     * Parse cached analysis from database
     */
    private AnalysisResultDto parseAnalysisResult(PlayerAnalysis pa) throws Exception {
        List<String> strengths = objectMapper.readValue(pa.getStrengths(),
                new TypeReference<List<String>>() {
                });
        List<String> weaknesses = objectMapper.readValue(pa.getWeaknesses(),
                new TypeReference<List<String>>() {
                });
        Map<String, Double> features = objectMapper.readValue(pa.getMetrics(),
                new TypeReference<Map<String, Double>>() {
                });

        // Create default predictions
        PredictionsDto predictions = new PredictionsDto(
                new CategoryAnalysisDto("average", 0.65, 1),
                new CategoryAnalysisDto("average", 0.60, 1),
                new CategoryAnalysisDto("average", 0.72, 1),
                new CategoryAnalysisDto("average", 0.65, 1),
                new CategoryAnalysisDto("average", 0.70, 1),
                new CategoryAnalysisDto("average", 0.60, 1)
        );

        return new AnalysisResultDto(
                "0",
                pa.getUpdatedAt().toString(),
                pa.getGamesAnalyzed(),
                predictions,
                strengths,
                weaknesses,
                features,
                "Keep improving your game through regular practice and analysis."
        );
    }
}
