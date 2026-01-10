import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar/Navbar";
import gameService, { type RecentGame, type GameDetail, type GameAnalysis } from "../api/games";
import { exportGamePGN } from "../utils/pgnExporter";
import "./GameHistoryPage.css";

const GameHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<RecentGame[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameDetail | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<GameAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
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

                {/* Analysis Card */}
                {selectedAnalysis ? (
                  <div className="gh-analysis-card">
                    <div className="gh-analysis-header">
                      <h3>📊 Game Analysis</h3>
                    </div>

                    <div className="gh-accuracy-section">
                      <div className="gh-accuracy-item">
                        <div className="gh-accuracy-label">White Accuracy</div>
                        <div className="gh-accuracy-bar">
                          <div
                            className="gh-accuracy-fill"
                            style={{
                              width: `${selectedAnalysis.whiteAccuracy}%`,
                            }}
                          />
                        </div>
                        <div className="gh-accuracy-value">
                          {selectedAnalysis.whiteAccuracy.toFixed(1)}%
                        </div>
                      </div>

                      <div className="gh-accuracy-item">
                        <div className="gh-accuracy-label">Black Accuracy</div>
                        <div className="gh-accuracy-bar">
                          <div
                            className="gh-accuracy-fill"
                            style={{
                              width: `${selectedAnalysis.blackAccuracy}%`,
                            }}
                          />
                        </div>
                        <div className="gh-accuracy-value">
                          {selectedAnalysis.blackAccuracy.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <div className="gh-mistakes-section">
                      <div className="gh-mistakes-col">
                        <h4>White's Mistakes</h4>
                        <div className="gh-mistake-count">
                          <span className="gh-mistake-item">
                            🔴 Blunders: {selectedAnalysis.whiteBlunders}
                          </span>
                          <span className="gh-mistake-item">
                            🟡 Mistakes: {selectedAnalysis.whiteMistakes}
                          </span>
                        </div>
                      </div>
                      <div className="gh-mistakes-col">
                        <h4>Black's Mistakes</h4>
                        <div className="gh-mistake-count">
                          <span className="gh-mistake-item">
                            🔴 Blunders: {selectedAnalysis.blackBlunders}
                          </span>
                          <span className="gh-mistake-item">
                            🟡 Mistakes: {selectedAnalysis.blackMistakes}
                          </span>
                        </div>
                      </div>
                    </div>

                    {selectedAnalysis.openingName && (
                      <div className="gh-opening-section">
                        <h4>📖 Opening</h4>
                        <p>{selectedAnalysis.openingName}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="gh-analysis-card">
                    <div className="gh-analysis-header">
                      <h3>⏳ Analysis Pending</h3>
                    </div>
                    <p>
                      This game's analysis is being generated. Please check back later
                      for detailed Stockfish evaluation and suggestions.
                    </p>
                  </div>
                )}
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
