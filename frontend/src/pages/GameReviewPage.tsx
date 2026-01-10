import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import Navbar from "../components/Navbar/Navbar";
import gameService, { type GameDetail, type GameAnalysis } from "../api/games";
import "./GameReviewPage.css";

interface MoveAnalysisData {
  moveNumber: number;
  moveIndex: number;
  san: string;
  evaluation: number;
  evaluationBefore: number;
  evaluationAfter: number;
  bestMove: string;
  moveClass: string;
  isMistake: boolean;
  isBlunder: boolean;
  isBrilliant: boolean;
  isExcellent: boolean;
  isGood: boolean;
  isOk: boolean;
  isInaccuracy: boolean;
}

const GameReviewPage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const [gameDetail, setGameDetail] = useState<GameDetail | null>(null);
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [fen, setFen] = useState("");
  const [boardWidth, setBoardWidth] = useState(480);
  const [moveAnalysisList, setMoveAnalysisList] = useState<MoveAnalysisData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (gameId) {
      loadGameData(parseInt(gameId));
    }
  }, [gameId]);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      let width = 480;
      if (w >= 1600) width = 520;
      else if (w >= 1400) width = 480;
      else if (w >= 1200) width = 440;
      else if (w >= 1024) width = 400;
      else if (w >= 800) width = 360;
      else width = Math.max(280, w - 60);
      setBoardWidth(width);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const loadGameData = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      console.log("📖 Loading game data for game ID:", id);
      const detail = await gameService.getGameDetail(id);
      console.log("✅ Game detail loaded:", detail);
      
      if (!detail) {
        console.error("❌ Game detail is null");
        setError("Failed to load game data");
        setLoading(false);
        return;
      }
      
      setGameDetail(detail);

      // Parse moves from JSON (optional - game might still display even without moves)
      if (detail.movesJson) {
        try {
          console.log("📝 Parsing moves from JSON...");
          const moves = JSON.parse(detail.movesJson);
          console.log("✅ Successfully parsed moves:", moves.length, "moves");
          // Reconstruct the game to get initial FEN
          const game = new Chess();
          if (moves.length > 0) {
            setFen(game.fen());
          }
        } catch (e) {
          console.error("❌ Failed to parse moves JSON:", e);
          console.error("   Moves JSON:", detail.movesJson?.substring(0, 200));
          // Don't set error - still allow viewing game without moves
        }
      } else {
        console.warn("⚠️ No movesJson in game detail");
        // Don't set error - game can still display
      }

      // Load analysis
      try {
        console.log("🔍 Loading analysis for game...");
        const analysisData = await gameService.getGameAnalysis(id);
        console.log("✅ Analysis loaded:", analysisData);
        
        // Check if analysis is valid (not a processing/error response)
        if (analysisData && 'whiteAccuracy' in analysisData) {
          setAnalysis(analysisData);

          if (analysisData.movesAnalysis) {
            try {
              const moves = JSON.parse(analysisData.movesAnalysis);
              console.log("✅ Parsed move analysis:", moves.length, "moves");
              setMoveAnalysisList(moves);
            } catch (e) {
              console.error("❌ Failed to parse move analysis:", e);
            }
          }
        } else {
          console.log("ℹ️ Analysis still processing:", analysisData);
        }
      } catch (e) {
        console.log("ℹ️ Analysis not available yet:", e);
      }
    } catch (error) {
      console.error("❌ Failed to load game:", error);
      setError(`Error loading game: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const getPosition = (moveIndex: number): string => {
    if (!gameDetail?.movesJson) return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    try {
      const moves = JSON.parse(gameDetail.movesJson);
      if (moveIndex < 0 || moveIndex >= moves.length) return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

      const game = new Chess();
      for (let i = 0; i <= moveIndex; i++) {
        game.move(moves[i].san);
      }
      return game.fen();
    } catch (e) {
      console.error("Error getting position:", e);
      return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    }
  };

  const getEvalBarWidth = (evaluation: number): number => {
    // Convert evaluation to percentage (0-100)
    // White advantage = higher %, Black advantage = lower %
    // Clamped between 0-100, with 50 being equal
    const width = 50 + Math.min(Math.max(evaluation * 10, -50), 50);
    return Math.max(0, Math.min(100, width));
  };

  const formatEvaluation = (evaluation: number): string => {
    if (Math.abs(evaluation) >= 10) {
      return evaluation > 0 ? "+M" : "#M"; // Mate
    }
    return `${evaluation > 0 ? "+" : ""}${evaluation.toFixed(2)}`;
  };

  /**
   * Get badge for move quality
   */
  const getMoveQualityBadge = (quality: string) => {
    const badges: { [key: string]: { emoji: string; label: string; color: string } } = {
      BRILLIANT: { emoji: "♦", label: "Brilliant", color: "#00d9ff" },
      EXCELLENT: { emoji: "✓", label: "Excellent", color: "#4caf50" },
      GOOD: { emoji: "•", label: "Good", color: "#8bc34a" },
      OK: { emoji: "○", label: "OK", color: "#9e9e9e" },
      INACCURACY: { emoji: "⚠", label: "Inaccuracy", color: "#ffc107" },
      MISTAKE: { emoji: "⚡", label: "Mistake", color: "#ff9800" },
      BLUNDER: { emoji: "✕", label: "Blunder", color: "#f44336" },
    };
    return badges[quality] || badges["OK"];
  };

  const handlePreviousMove = () => {
    setCurrentMoveIndex(Math.max(0, currentMoveIndex - 1));
  };

  const handleNextMove = () => {
    if (gameDetail?.movesJson) {
      try {
        const moves = JSON.parse(gameDetail.movesJson);
        setCurrentMoveIndex(Math.min(moves.length - 1, currentMoveIndex + 1));
      } catch (e) {
        console.error("Error:", e);
      }
    }
  };

  useEffect(() => {
    setFen(getPosition(currentMoveIndex));
  }, [currentMoveIndex, gameDetail]);

  if (loading) {
    return (
      <>
        <Navbar rating={1847} streak={5} />
        <div className="gr-page loading-page">
          <div className="gr-loading">⏳ Loading game review...</div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar rating={1847} streak={5} />
        <div className="gr-page error-page">
          <div className="gr-error">❌ {error}</div>
          <button className="gr-back-btn" onClick={() => navigate("/game-history")}>
            Back to Games
          </button>
        </div>
      </>
    );
  }

  if (!gameDetail) {
    return (
      <>
        <Navbar rating={1847} streak={5} />
        <div className="gr-page error-page">
          <div className="gr-error">❌ Game not found</div>
          <button className="gr-back-btn" onClick={() => navigate("/game-history")}>
            Back to Games
          </button>
        </div>
      </>
    );
  }

  const currentAnalysis =
    moveAnalysisList.length > currentMoveIndex
      ? moveAnalysisList[currentMoveIndex]
      : null;

  let moves: any[] = [];
  try {
    moves = gameDetail.movesJson ? JSON.parse(gameDetail.movesJson) : [];
  } catch (e) {
    console.error("Error parsing moves:", e);
    moves = [];
  }
  
  // Get current move
  const currentMove = moves.length > currentMoveIndex ? moves[currentMoveIndex] : null;

  return (
    <>
      <Navbar rating={1847} streak={5} />

      <div className="gr-page">
        <div className="gr-back-row">
          <button className="gr-back-btn" onClick={() => navigate("/game-history")}>
            ← Back to Games
          </button>
          <h1 className="gr-title">📊 Game Review - {gameDetail.opponentName}</h1>
        </div>

        <div className="gr-main-layout">
          {/* LEFT - BOARD */}
          <div className="gr-left-column">
            <div className="gr-board-card">
              <div className="gr-board-header">
                <h2>Move: {Math.floor(currentMoveIndex / 2) + 1}</h2>
                <span className="gr-move-badge">
                  {currentMove?.san || "Start"}
                </span>
              </div>

              <Chessboard
                position={fen}
                boardWidth={boardWidth}
                customBoardStyle={{
                  borderRadius: "12px",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.9)",
                }}
              />

              <div className="gr-board-controls">
                <button className="gr-control-btn" onClick={handlePreviousMove}>
                  ⬅️ Previous
                </button>
                <span className="gr-move-counter">
                  {currentMoveIndex + 1} / {moves.length}
                </span>
                <button className="gr-control-btn" onClick={handleNextMove}>
                  Next ➡️
                </button>
              </div>
            </div>

            {/* Moves List */}
            <div className="gr-moves-card">
              <div className="gr-moves-header">
                <h3>♟️ Moves</h3>
              </div>
              <div className="gr-moves-list">
                {moves.map((move: any, idx: number) => (
                  <button
                    key={idx}
                    className={`gr-move-item ${
                      idx === currentMoveIndex ? "active" : ""
                    }`}
                    onClick={() => setCurrentMoveIndex(idx)}
                  >
                    {Math.floor(idx / 2) + 1}
                    {idx % 2 === 0 ? "." : "..."}
                    {move.san}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT - ANALYSIS */}
          <div className="gr-right-column">
            {/* Game Info */}
            <div className="gr-info-card">
              <h2>Game Information</h2>
              <div className="gr-info-grid">
                <div className="gr-info-item">
                  <span className="gr-info-label">Result:</span>
                  <span className="gr-info-value">{gameDetail.result}</span>
                </div>
                <div className="gr-info-item">
                  <span className="gr-info-label">Time Control:</span>
                  <span className="gr-info-value">{gameDetail.timeControl}</span>
                </div>
                <div className="gr-info-item">
                  <span className="gr-info-label">Moves:</span>
                  <span className="gr-info-value">{gameDetail.moveCount}</span>
                </div>
                <div className="gr-info-item">
                  <span className="gr-info-label">Accuracy:</span>
                  <span className="gr-info-value">
                    {gameDetail.accuracyPercentage}%
                  </span>
                </div>
              </div>
              {analysis?.openingName && (
                <div style={{ marginTop: "15px", paddingTop: "15px", borderTop: "1px solid var(--border-color)" }}>
                  <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>📖 Opening</div>
                  <div style={{ fontSize: "16px", color: "var(--text-primary)", marginTop: "5px", fontWeight: "500" }}>
                    {analysis.openingName}
                  </div>
                </div>
              )}
            </div>

            {/* Move Analysis */}
            {currentMove && moveAnalysisList.length > 0 && moveAnalysisList[currentMoveIndex] && (
              <div className="gr-move-analysis-card">
                <h2>Current Move Analysis</h2>
                <div className="gr-analysis-content">
                  <div className="gr-move-header">
                    <div className="gr-move-notation">
                      <span className="gr-move-number">
                        {Math.floor(currentMoveIndex / 2) + 1}
                        {currentMoveIndex % 2 === 0 ? "." : "..."}
                      </span>
                      <span className="gr-move-san">{currentMove.san}</span>
                    </div>
                    {moveAnalysisList[currentMoveIndex].quality && (
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        {(() => {
                          const badge = getMoveQualityBadge(moveAnalysisList[currentMoveIndex].quality);
                          return (
                            <div
                              style={{
                                background: badge.color,
                                color: "#000",
                                padding: "6px 12px",
                                borderRadius: "6px",
                                fontSize: "14px",
                                fontWeight: "bold",
                              }}
                            >
                              {badge.emoji} {badge.label}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "15px 0", textAlign: "center", color: "var(--text-secondary)" }}>
                    Move {currentMoveIndex + 1} of {moves.length}
                  </div>
                </div>
              </div>
            )}

            {/* Move Analysis - Basic (when detailed analysis not available) */}
            {currentMove && (moveAnalysisList.length === 0 || !moveAnalysisList[currentMoveIndex]) && (
              <div className="gr-move-analysis-card">
                <h2>Current Move</h2>
                <div className="gr-analysis-content">
                  <div className="gr-move-header">
                    <div className="gr-move-notation">
                      <span className="gr-move-number">
                        {Math.floor(currentMoveIndex / 2) + 1}
                        {currentMoveIndex % 2 === 0 ? "." : "..."}
                      </span>
                      <span className="gr-move-san">{currentMove.san}</span>
                    </div>
                  </div>
                  <div style={{ padding: "15px 0", textAlign: "center", color: "var(--text-secondary)" }}>
                    Move {currentMoveIndex + 1} of {moves.length}
                  </div>
                </div>
              </div>
            )}

            {/* Game Statistics */}
            <div className="gr-stats-card">
              <h2>📊 Game Statistics</h2>
              <div className="gr-stats-grid">
                {analysis ? (
                  <>
                    <div className="gr-stat-item">
                      <div className="gr-stat-label">White Accuracy</div>
                      <div className="gr-stat-bar">
                        <div
                          className="gr-stat-fill"
                          style={{ width: `${analysis.whiteAccuracy ?? 0}%` }}
                        />
                      </div>
                      <div className="gr-stat-value">
                        {(analysis.whiteAccuracy ?? 0).toFixed(1)}%
                      </div>
                    </div>

                    <div className="gr-stat-item">
                      <div className="gr-stat-label">Black Accuracy</div>
                      <div className="gr-stat-bar">
                        <div
                          className="gr-stat-fill"
                          style={{ width: `${analysis.blackAccuracy ?? 0}%` }}
                        />
                      </div>
                      <div className="gr-stat-value">
                        {(analysis.blackAccuracy ?? 0).toFixed(1)}%
                      </div>
                    </div>

                    <div className="gr-stat-item">
                      <div className="gr-stat-label">White Blunders</div>
                      <div className="gr-stat-count blunder">
                        {analysis.whiteBlunders ?? 0}
                      </div>
                    </div>

                    <div className="gr-stat-item">
                      <div className="gr-stat-label">Black Blunders</div>
                      <div className="gr-stat-count blunder">
                        {analysis.blackBlunders ?? 0}
                      </div>
                    </div>

                    <div className="gr-stat-item">
                      <div className="gr-stat-label">White Mistakes</div>
                      <div className="gr-stat-count mistake">
                        {analysis.whiteMistakes ?? 0}
                      </div>
                    </div>

                    <div className="gr-stat-item">
                      <div className="gr-stat-label">Black Mistakes</div>
                      <div className="gr-stat-count mistake">
                        {analysis.blackMistakes ?? 0}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--text-secondary)", gridColumn: "1 / -1" }}>
                    ⏳ Analysis in progress...
                  </div>
                )}
              </div>

              {analysis?.openingName && (
                <div className="gr-opening-info">
                  <h3>📖 Opening: {analysis.openingName}</h3>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default GameReviewPage;
