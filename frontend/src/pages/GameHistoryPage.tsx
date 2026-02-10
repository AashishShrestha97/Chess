import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar/Navbar";
import gameService, { type RecentGame, type GameDetail, type GameAnalysis } from "../api/games";
import { exportGamePGN } from "../utils/pgnExporter";
import "./GameHistoryPage.css";

interface DetailedAnalysis {
  gameId: number;
  whiteAccuracy?: number;
  blackAccuracy?: number;
  whiteBlunders: number;
  whiteMistakes: number;
  whiteInaccuracies: number;
  blackBlunders: number;
  blackMistakes: number;
  blackInaccuracies: number;
  opening?: string;
  totalMoves: number;
}

const GameHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<RecentGame[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameDetail | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<GameAnalysis | null>(null);
  const [detailedAnalysis, setDetailedAnalysis] = useState<DetailedAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analyzingGame, setAnalyzingGame] = useState(false);
  const [filter, setFilter] = useState<"all" | "wins" | "losses" | "draws">("all");

  useEffect(() => {
    loadGames();
  }, []);

  const loadGames = async () => {
    setLoading(true);
    try {
      const data = await gameService.getUserAllGames();
      setGames(data || []);
      console.log("✅ Loaded", data?.length || 0, "games");
    } catch (error) {
      console.error("❌ Failed to load games:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectGame = async (game: RecentGame) => {
    setLoadingAnalysis(true);
    try {
      const detail = await gameService.getGameDetail(game.id);
      setSelectedGame(detail);
      setSelectedAnalysis(null);

      // Try to load analysis (it might not be ready yet)
      try {
        const analysis = await gameService.getGameAnalysis(game.id);
        setSelectedAnalysis(analysis);
      } catch (e) {
        console.log("⏳ Analysis not yet available");
      }
    } catch (error) {
      console.error("❌ Failed to load game detail:", error);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleAnalyzeGame = async (gameId: number) => {
    setAnalyzingGame(true);
    try {
      console.log("🔬 Requesting detailed analysis for game:", gameId);
      const analysis = await gameService.getDetailedGameAnalysis(gameId);
      console.log("✅ Detailed analysis received:", analysis);
      setDetailedAnalysis({
        gameId: analysis.gameId,
        whiteAccuracy: analysis.whiteAccuracy,
        blackAccuracy: analysis.blackAccuracy,
        whiteBlunders: analysis.whiteBlunders,
        whiteMistakes: analysis.whiteMistakes,
        whiteInaccuracies: analysis.whiteInaccuracies,
        blackBlunders: analysis.blackBlunders,
        blackMistakes: analysis.blackMistakes,
        blackInaccuracies: analysis.blackInaccuracies,
        opening: analysis.opening,
        totalMoves: analysis.totalMoves,
      });
    } catch (error) {
      console.error("❌ Analysis failed:", error);
      alert("❌ Analysis failed. Make sure Stockfish is installed and the game has valid PGN data.");
    } finally {
      setAnalyzingGame(false);
    }
  };

  const getFilteredGames = () => {
    return games.filter((game) => {
      if (filter === "all") return true;
      return game.result.toUpperCase() === filter.toUpperCase();
    });
  };

  const getResultColor = (result: string) => {
    switch (result.toUpperCase()) {
      case "WIN":
        return "result-win";
      case "LOSS":
        return "result-loss";
      case "DRAW":
        return "result-draw";
      default:
        return "";
    }
  };

  const getResultEmoji = (result: string) => {
    switch (result.toUpperCase()) {
      case "WIN":
        return "🏆";
      case "LOSS":
        return "❌";
      case "DRAW":
        return "🤝";
      default:
        return "●";
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDownloadPGN = () => {
    if (!selectedGame) return;

    // Determine player colors based on result
    const isWhite = selectedGame.result !== "LOSS"; // This is a simple heuristic
    const whitePlayer = isWhite ? "You" : selectedGame.opponentName;
    const blackPlayer = !isWhite ? "You" : selectedGame.opponentName;

    // Always prefer movesJson as it's the cleanest source
    let movesString = "";
    
    if (selectedGame.movesJson) {
      try {
        const movesData = JSON.parse(selectedGame.movesJson);
        // Extract just the SAN notation from each move object
        movesString = movesData.map((move: any) => move.san || move).join(" ");
      } catch (e) {
        console.error("Failed to parse movesJson:", e);
        movesString = "";
      }
    }

    // Fallback to pgn field if movesJson failed, but extract only moves
    if (!movesString && selectedGame.pgn) {
      try {
        // Extract moves part (everything after headers like [Event, [Site, etc)
        // Headers end with ], moves start with numbers like "1. e4"
        const pgnText = selectedGame.pgn;
        const movesMatch = pgnText.match(/\d+\.\s+[a-zA-Z0-9\-+#=()]+.*/);
        if (movesMatch) {
          movesString = movesMatch[0];
        }
      } catch (e) {
        console.error("Failed to extract moves from pgn:", e);
      }
    }

    exportGamePGN(
      selectedGame.id.toString(),
      whitePlayer,
      blackPlayer,
      selectedGame.result,
      selectedGame.playedAt,
      movesString,
      selectedGame.timeControl,
      selectedGame.terminationReason,
      selectedAnalysis?.openingName
    );
  };

  const filteredGames = getFilteredGames();

  return (
    <>
      <Navbar rating={1847} streak={5} />

      <div className="game-history-page">
        <div className="gh-back-row">
          <button className="gh-back-btn" onClick={() => navigate("/home")}>
            ← Back to Home
          </button>
          <h1 className="gh-title">📚 Past Games & Analysis</h1>
        </div>

        <div className="gh-main-layout">
          {/* LEFT - GAMES LIST */}
          <div className="gh-left-column">
            <div className="gh-games-card">
              <div className="gh-header">
                <h2>Your Games</h2>
                <span className="gh-count">{filteredGames.length} games</span>
              </div>

              <div className="gh-filters">
                {(["all", "wins", "losses", "draws"] as const).map((f) => (
                  <button
                    key={f}
                    className={`gh-filter-btn ${filter === f ? "active" : ""}`}
                    onClick={() => setFilter(f)}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="gh-loading">⏳ Loading games...</div>
              ) : filteredGames.length === 0 ? (
                <div className="gh-empty">
                  <p>No games yet. Start playing to record your games!</p>
                </div>
              ) : (
                <div className="gh-games-list">
                  {filteredGames.map((game, idx) => (
                    <div
                      key={game.id}
                      className={`gh-game-item ${
                        selectedGame?.id === game.id ? "selected" : ""
                      }`}
                      onClick={() => selectGame(game)}
                    >
                      <div className="gh-game-left">
                        <div className={`gh-result-badge ${getResultColor(game.result)}`}>
                          {getResultEmoji(game.result)}
                        </div>
                        <div>
                          <div className="gh-game-opponent">{game.opponentName}</div>
                          <div className="gh-game-meta">{game.timeAgo}</div>
                        </div>
                      </div>
                      <div className="gh-game-right">
                        {game.ratingChange !== 0 && (
                          <div
                            className={`gh-rating-change ${
                              game.ratingChange > 0 ? "positive" : "negative"
                            }`}
                          >
                            {game.ratingChange > 0 ? "+" : ""}
                            {game.ratingChange}
                          </div>
                        )}
                        {game.accuracyPercentage && (
                          <div className="gh-accuracy">
                            {game.accuracyPercentage}%
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT - GAME DETAIL & ANALYSIS */}
          <div className="gh-right-column">
            {loadingAnalysis ? (
              <div className="gh-detail-card loading">
                <div className="gh-loading">⏳ Loading game details...</div>
              </div>
            ) : selectedGame ? (
              <>
                {/* Game Detail */}
                <div className="gh-detail-card">
                  <div className="gh-detail-header">
                    <h2>Game Details</h2>
                    <div className="gh-buttons-wrapper">
                      <button
                        className="gh-download-pgn-btn"
                        onClick={handleDownloadPGN}
                        title="Download game in PGN format"
                      >
                        ⬇️ Download PGN
                      </button>
                      <button
                        className="gh-view-review-btn"
                        onClick={() => navigate(`/game-review/${selectedGame.id}`)}
                      >
                        📊 Full Review
                      </button>
                      <button
                        className="gh-analyze-btn"
                        onClick={() => handleAnalyzeGame(selectedGame.id)}
                        title="Get detailed Stockfish analysis (like Chess.com)"
                      >
                        🔬 Analyze
                      </button>
                    </div>
                  </div>

                  <div className="gh-detail-content">
                    <div className="gh-detail-row">
                      <span className="gh-detail-label">Opponent:</span>
                      <span className="gh-detail-value">
                        {selectedGame.opponentName}
                      </span>
                    </div>
                    <div className="gh-detail-row">
                      <span className="gh-detail-label">Result:</span>
                      <span className={`gh-detail-value ${getResultColor(selectedGame.result)}`}>
                        {getResultEmoji(selectedGame.result)} {selectedGame.result}
                      </span>
                    </div>
                    <div className="gh-detail-row">
                      <span className="gh-detail-label">Time Control:</span>
                      <span className="gh-detail-value">{selectedGame.timeControl}</span>
                    </div>
                    <div className="gh-detail-row">
                      <span className="gh-detail-label">Game Type:</span>
                      <span className="gh-detail-value">{selectedGame.gameType}</span>
                    </div>
                    <div className="gh-detail-row">
                      <span className="gh-detail-label">Moves:</span>
                      <span className="gh-detail-value">{selectedGame.moveCount}</span>
                    </div>
                    <div className="gh-detail-row">
                      <span className="gh-detail-label">Accuracy:</span>
                      <span className="gh-detail-value">
                        {selectedGame.accuracyPercentage}%
                      </span>
                    </div>
                    <div className="gh-detail-row">
                      <span className="gh-detail-label">Rating Change:</span>
                      <span
                        className={`gh-detail-value ${
                          selectedGame.ratingChange > 0 ? "positive" : "negative"
                        }`}
                      >
                        {selectedGame.ratingChange > 0 ? "+" : ""}
                        {selectedGame.ratingChange}
                      </span>
                    </div>
                    <div className="gh-detail-row">
                      <span className="gh-detail-label">Date Played:</span>
                      <span className="gh-detail-value">
                        {formatDate(selectedGame.playedAt)}
                      </span>
                    </div>
                    <div className="gh-detail-row">
                      <span className="gh-detail-label">Termination:</span>
                      <span className="gh-detail-value">
                        {selectedGame.terminationReason}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Detailed Stockfish Analysis Card */}
                {analyzingGame ? (
                  <div className="gh-detailed-analysis-card">
                    <div className="gh-loading-spinner">
                      <div className="spinner"></div>
                      <p>🔬 Analyzing game with Stockfish...</p>
                    </div>
                  </div>
                ) : detailedAnalysis ? (
                  <div className="gh-detailed-analysis-card">
                    <div className="gh-analysis-header">
                      <h3>🔬 Stockfish Analysis</h3>
                    </div>

                    {/* Accuracy Bars */}
                    <div className="gh-stockfish-accuracy">
                      <div className="gh-accuracy-row">
                        <div className="gh-accuracy-item-stockfish">
                          <div className="gh-player-label">White</div>
                          <div className="gh-accuracy-bar-large">
                            <div
                              className="gh-accuracy-fill-white"
                              style={{
                                width: `${detailedAnalysis.whiteAccuracy ?? 0}%`,
                              }}
                            />
                          </div>
                          <div className="gh-accuracy-value-large">
                            {(detailedAnalysis.whiteAccuracy ?? 0).toFixed(1)}%
                          </div>
                        </div>

                        <div className="gh-accuracy-item-stockfish">
                          <div className="gh-player-label">Black</div>
                          <div className="gh-accuracy-bar-large">
                            <div
                              className="gh-accuracy-fill-black"
                              style={{
                                width: `${detailedAnalysis.blackAccuracy ?? 0}%`,
                              }}
                            />
                          </div>
                          <div className="gh-accuracy-value-large">
                            {(detailedAnalysis.blackAccuracy ?? 0).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Error Breakdown */}
                    <div className="gh-error-breakdown">
                      <div className="gh-error-col">
                        <h4>♔ White's Performance</h4>
                        <div className="gh-error-items">
                          <div className="gh-error-item blunder">
                            <span className="gh-error-icon">🔴</span>
                            <span className="gh-error-text">Blunders</span>
                            <span className="gh-error-count">{detailedAnalysis.whiteBlunders}</span>
                          </div>
                          <div className="gh-error-item mistake">
                            <span className="gh-error-icon">🟠</span>
                            <span className="gh-error-text">Mistakes</span>
                            <span className="gh-error-count">{detailedAnalysis.whiteMistakes}</span>
                          </div>
                          <div className="gh-error-item inaccuracy">
                            <span className="gh-error-icon">🟡</span>
                            <span className="gh-error-text">Inaccuracies</span>
                            <span className="gh-error-count">{detailedAnalysis.whiteInaccuracies}</span>
                          </div>
                        </div>
                      </div>

                      <div className="gh-error-col">
                        <h4>♚ Black's Performance</h4>
                        <div className="gh-error-items">
                          <div className="gh-error-item blunder">
                            <span className="gh-error-icon">🔴</span>
                            <span className="gh-error-text">Blunders</span>
                            <span className="gh-error-count">{detailedAnalysis.blackBlunders}</span>
                          </div>
                          <div className="gh-error-item mistake">
                            <span className="gh-error-icon">🟠</span>
                            <span className="gh-error-text">Mistakes</span>
                            <span className="gh-error-count">{detailedAnalysis.blackMistakes}</span>
                          </div>
                          <div className="gh-error-item inaccuracy">
                            <span className="gh-error-icon">🟡</span>
                            <span className="gh-error-text">Inaccuracies</span>
                            <span className="gh-error-count">{detailedAnalysis.blackInaccuracies}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Game Stats */}
                    <div className="gh-stockfish-stats">
                      {detailedAnalysis.opening && (
                        <div className="gh-stat-item">
                          <span className="gh-stat-label">Opening:</span>
                          <span className="gh-stat-value">{detailedAnalysis.opening}</span>
                        </div>
                      )}
                      <div className="gh-stat-item">
                        <span className="gh-stat-label">Total Moves:</span>
                        <span className="gh-stat-value">{detailedAnalysis.totalMoves}</span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="gh-detail-card">
                <div className="gh-empty-state">
                  <p>👈 Select a game to view details and analysis</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default GameHistoryPage;
