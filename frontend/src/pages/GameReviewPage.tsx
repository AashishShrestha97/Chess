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

      // Parse moves from JSON
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
          setError("Failed to parse game moves");
        }
      } else {
        console.warn("⚠️ No movesJson in game detail");
        setError("Game has no moves data");
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

  const moves = gameDetail.movesJson ? JSON.parse(gameDetail.movesJson) : [];

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
                  {currentAnalysis?.san || "Start"}
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
            </div>

            {/* Move Analysis */}
            {currentAnalysis && (
              <div className="gr-move-analysis-card">
                <h2>Move Analysis</h2>
                <div className="gr-analysis-content">
                  {/* Move with classification */}
                  <div className="gr-move-header">
                    <div className="gr-move-notation">
                      <span className="gr-move-number">
                        {currentAnalysis.moveNumber}
                        {currentAnalysis.moveIndex % 2 === 0 ? "." : "..."}
                      </span>
                      <span className="gr-move-san">{currentAnalysis.san}</span>
                    </div>
                    <div className="gr-move-classification">
                      {currentAnalysis.isBrilliant && (
                        <span className="gr-badge brilliant">♦ Brilliant</span>
                      )}
                      {currentAnalysis.isExcellent && !currentAnalysis.isBrilliant && (
                        <span className="gr-badge excellent">✓ Excellent</span>
                      )}
                      {currentAnalysis.isGood && !currentAnalysis.isExcellent && (
                        <span className="gr-badge good">✓ Good</span>
                      )}
                      {currentAnalysis.isOk && !currentAnalysis.isGood && (
                        <span className="gr-badge ok">• OK</span>
                      )}
                      {currentAnalysis.isInaccuracy && (
                        <span className="gr-badge inaccuracy">⚠ Inaccuracy</span>
                      )}
                      {currentAnalysis.isMistake && !currentAnalysis.isInaccuracy && (
                        <span className="gr-badge mistake">⚡ Mistake</span>
                      )}
                      {currentAnalysis.isBlunder && !currentAnalysis.isMistake && (
                        <span className="gr-badge blunder">✕ Blunder</span>
                      )}
                    </div>
                  </div>

                  {/* Evaluation bar - Chess.com style */}
                  <div className="gr-evaluation-section">
                    <div className="gr-eval-before-after">
                      <div className="gr-eval-item">
                        <span className="gr-eval-label">Before Move</span>
                        <span className="gr-eval-number">
                          {currentAnalysis.evaluationBefore > 0 ? "+" : ""}
                          {currentAnalysis.evaluationBefore.toFixed(2)}
                        </span>
                      </div>
                      <div className="gr-eval-arrow">→</div>
                      <div className="gr-eval-item">
                        <span className="gr-eval-label">After Move</span>
                        <span className="gr-eval-number">
                          {currentAnalysis.evaluationAfter > 0 ? "+" : ""}
                          {currentAnalysis.evaluationAfter.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Real-time evaluation bar */}
                    <div className="gr-eval-bar-container">
                      <div className="gr-eval-bar-label">Evaluation</div>
                      <div className="gr-eval-bar">
                        <div
                          className="gr-eval-white"
                          style={{
                            width: `${getEvalBarWidth(
                              currentAnalysis.evaluationAfter
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="gr-eval-bar-value">
                        {formatEvaluation(currentAnalysis.evaluationAfter)}
                      </div>
                    </div>
                  </div>

                  {/* Evaluation delta */}
                  <div className="gr-eval-delta">
                    <span className="gr-delta-label">Position Change</span>
                    <span
                      className={`gr-delta-value ${
                        currentAnalysis.evaluationAfter >
                        currentAnalysis.evaluationBefore
                          ? "positive"
                          : "negative"
                      }`}
                    >
                      {currentAnalysis.evaluationAfter >
                      currentAnalysis.evaluationBefore
                        ? "+"
                        : ""}
                      {(
                        currentAnalysis.evaluationAfter -
                        currentAnalysis.evaluationBefore
                      ).toFixed(2)}
                    </span>
                  </div>

                  {/* Best move suggestion */}
                  {currentAnalysis.bestMove && (
                    <div className="gr-best-move-section">
                      <div className="gr-best-move-label">Best Move</div>
                      <div className="gr-best-move-value">
                        {currentAnalysis.bestMove}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Game Statistics */}
            {analysis && (
              <div className="gr-stats-card">
                <h2>📊 Game Statistics</h2>
                <div className="gr-stats-grid">
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
                      {analysis.whiteBlunders}
                    </div>
                  </div>

                  <div className="gr-stat-item">
                    <div className="gr-stat-label">Black Blunders</div>
                    <div className="gr-stat-count blunder">
                      {analysis.blackBlunders}
                    </div>
                  </div>

                  <div className="gr-stat-item">
                    <div className="gr-stat-label">White Mistakes</div>
                    <div className="gr-stat-count mistake">
                      {analysis.whiteMistakes}
                    </div>
                  </div>

                  <div className="gr-stat-item">
                    <div className="gr-stat-label">Black Mistakes</div>
                    <div className="gr-stat-count mistake">
                      {analysis.blackMistakes}
                    </div>
                  </div>
                </div>

                {analysis.openingName && (
                  <div className="gr-opening-info">
                    <h3>📖 Opening: {analysis.openingName}</h3>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default GameReviewPage;
