import React, { useState, useEffect } from "react";
import { getGameModeStatistics, type GameModeStatistics } from "../../api/profile";
import "./GameModeStats.css";
import { FiTrendingUp, FiAlertCircle, FiClock } from "react-icons/fi";

/**
 * Component to display game mode statistics
 * Shows performance metrics for Bullet, Blitz, Rapid, and Classical games
 */
const GameModeStats: React.FC = () => {
  const [gameModeStats, setGameModeStats] = useState<GameModeStatistics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGameModeStats();
  }, []);

  const loadGameModeStats = async () => {
    try {
      setLoading(true);
      const response = await getGameModeStatistics();
      setGameModeStats(response.data);
      setError(null);
    } catch (err) {
      console.error("Error loading game mode stats:", err);
      setError("Failed to load game mode statistics");
    } finally {
      setLoading(false);
    }
  };

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 60) return "#4CAF50"; // Green
    if (winRate >= 50) return "#2196F3"; // Blue
    if (winRate >= 40) return "#FF9800"; // Orange
    return "#f44336"; // Red
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return "#4CAF50";
    if (accuracy >= 70) return "#2196F3";
    if (accuracy >= 60) return "#FF9800";
    return "#f44336";
  };

  if (loading) {
    return (
      <div className="game-mode-stats">
        <div className="stats-loading">Loading game mode statistics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-mode-stats">
        <div className="stats-error">
          <FiAlertCircle /> {error}
        </div>
      </div>
    );
  }

  // Filter out modes with no games
  const modesWithGames = gameModeStats.filter(stat => stat.totalGames > 0);

  return (
    <div className="game-mode-stats">
      <div className="stats-header">
        <h2>Performance by Game Mode</h2>
        <p className="stats-subtitle">Your statistics across different time controls</p>
      </div>

      {modesWithGames.length === 0 ? (
        <div className="no-games-message">
          <p>No games played yet. Start playing to see statistics!</p>
        </div>
      ) : (
        <div className="game-modes-grid">
          {modesWithGames.map((stat) => (
            <div key={stat.modeName} className="game-mode-card">
              <div className="mode-header">
                <span className="mode-icon">{stat.icon}</span>
                <div className="mode-info">
                  <h3 className="mode-name">{stat.displayName}</h3>
                  <span className="game-count">{stat.totalGames} games</span>
                </div>
              </div>

              <div className="stats-row">
                <div className="stat-item">
                  <div className="stat-label">Win Rate</div>
                  <div className="stat-value" style={{ color: getWinRateColor(stat.winRate) }}>
                    {stat.winRate.toFixed(1)}%
                  </div>
                  <div className="stat-bar">
                    <div className="bar-fill" style={{ width: `${stat.winRate}%`, backgroundColor: getWinRateColor(stat.winRate) }}></div>
                  </div>
                </div>

                <div className="stat-item">
                  <div className="stat-label">Accuracy</div>
                  <div className="stat-value" style={{ color: getAccuracyColor(stat.averageAccuracy) }}>
                    {stat.averageAccuracy}%
                  </div>
                  <div className="stat-bar">
                    <div className="bar-fill" style={{ width: `${stat.averageAccuracy}%`, backgroundColor: getAccuracyColor(stat.averageAccuracy) }}></div>
                  </div>
                </div>
              </div>

              <div className="stats-breakdown">
                <div className="result win">
                  <span className="result-icon">✓</span>
                  <span className="result-label">Wins</span>
                  <span className="result-count">{stat.wins}</span>
                </div>
                <div className="result draw">
                  <span className="result-icon">=</span>
                  <span className="result-label">Draws</span>
                  <span className="result-count">{stat.draws}</span>
                </div>
                <div className="result loss">
                  <span className="result-icon">✗</span>
                  <span className="result-label">Losses</span>
                  <span className="result-count">{stat.losses}</span>
                </div>
              </div>

              <div className="time-played">
                <FiClock size={16} />
                <span>{stat.totalTimeSpentMinutes} minutes played</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GameModeStats;
