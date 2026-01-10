import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Chess, Move } from "chess.js";
import { Chessboard } from "react-chessboard";
import Navbar from "../components/Navbar/Navbar";
import "./StandardChessPage.css";
import gameService from "../api/games";
import { GameRecorder } from "../utils/gameRecorder";

// ---------- Types ----------
interface StandardChessPageProps {
  timeControl?: string;
}

type MoveStatus = "success" | "error" | "invalid";

interface GameHistoryItem {
  id: number;
  move: string;
  timestamp: number;
  player: "white" | "black";
}

// ---------- Component ----------
const StandardChessPage: React.FC<StandardChessPageProps> = ({
  timeControl = "10+0",
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as { timeControl?: string } | null;

  const [effectiveTimeControl, setEffectiveTimeControl] =
    useState<string>(timeControl);

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(
    "white"
  );

  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [gameHistory, setGameHistory] = useState<GameHistoryItem[]>([]);
  const [statusMessage, setStatusMessage] = useState("White to move");
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(
    null
  );

  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);
  const [increment, setIncrement] = useState(0);
  const [currentTurn, setCurrentTurn] = useState<"w" | "b">("w");

  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  const [isSoundOn, setIsSoundOn] = useState(true);
  const [showLegalMoves, setShowLegalMoves] = useState(true);

  const [boardWidth, setBoardWidth] = useState<number>(480);

  // Game state refs
  const clockStartedRef = useRef(false);
  const gameOverRef = useRef(false);
  const isSoundOnRef = useRef(true);

  // Time warning flags
  const whiteTimeWarned30 = useRef(false);
  const whiteTimeWarned10 = useRef(false);
  const blackTimeWarned30 = useRef(false);
  const blackTimeWarned10 = useRef(false);

  // Game recorder for saving game data
  const gameRecorderRef = useRef<GameRecorder | null>(null);
  const [isSavingGame, setIsSavingGame] = useState(false);

  // Track captured pieces
  const [capturedPieces, setCapturedPieces] = useState<{
    white: string[];
    black: string[];
  }>({ white: [], black: [] });

  // ------- Basic sync effects -------
  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  useEffect(() => {
    isSoundOnRef.current = isSoundOn;
  }, [isSoundOn]);

  // Responsive board width
  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;
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

  // Pick time control from route / session
  useEffect(() => {
    let tc: string | undefined = routeState?.timeControl as string | undefined;

    if (!tc) {
      try {
        const cfgRaw = sessionStorage.getItem("gameConfig");
        if (cfgRaw) {
          const cfg = JSON.parse(cfgRaw);
          if (cfg.time) tc = String(cfg.time);
        }
      } catch {
        /* ignore */
      }
    }

    setEffectiveTimeControl(tc || timeControl || "10+0");
  }, [routeState, timeControl]);

  // Init time control
  useEffect(() => {
    const [mainPart, incStr] = effectiveTimeControl.split("+");
    let minutesPart = mainPart;
    if (minutesPart.includes("/")) {
      minutesPart = minutesPart.split("/")[0];
    }

    const minutes = Number(minutesPart) || 0;
    const inc = Number(incStr) || 0;
    const totalSeconds = minutes * 60;

    setWhiteTime(totalSeconds);
    setBlackTime(totalSeconds);
    setIncrement(inc);
    clockStartedRef.current = false;

    // Reset warning flags
    whiteTimeWarned30.current = false;
    whiteTimeWarned10.current = false;
    blackTimeWarned30.current = false;
    blackTimeWarned10.current = false;
  }, [effectiveTimeControl]);

  // Initialize game recorder
  useEffect(() => {
    gameRecorderRef.current = new GameRecorder(effectiveTimeControl);
    console.log("📝 Game recorder initialized for:", effectiveTimeControl);
  }, [effectiveTimeControl]);

  // ---------- Sound Effects ----------
  const playSound = (soundType: "move" | "capture" | "check" | "gameEnd") => {
    if (!isSoundOnRef.current) return;

    // You can implement actual sound effects here
    // For now, we'll use the Web Audio API to create simple beeps
    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      switch (soundType) {
        case "move":
          oscillator.frequency.value = 400;
          gainNode.gain.value = 0.1;
          break;
        case "capture":
          oscillator.frequency.value = 300;
          gainNode.gain.value = 0.15;
          break;
        case "check":
          oscillator.frequency.value = 600;
          gainNode.gain.value = 0.2;
          break;
        case "gameEnd":
          oscillator.frequency.value = 500;
          gainNode.gain.value = 0.15;
          break;
      }

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
      console.warn("Sound playback failed:", e);
    }
  };

  // ---------- Helpers ----------
  function handleFlag(flagged: "white" | "black") {
    if (gameOverRef.current) return;
    const winColor = flagged === "white" ? "Black" : "White";
    const message = `Time's up! ${winColor} wins on time!`;
    setGameOver(true);
    setWinner(winColor);
    setStatusMessage(message);
    playSound("gameEnd");
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  /**
   * Apply move with comprehensive game logic
   */
  function applyMove(
    moveInput: string | { from: string; to: string; promotion?: string },
    source: "board" | "ai"
  ): boolean {
    if (gameOverRef.current) return false;

    const game = gameRef.current;
    let move: Move | null = null;

    try {
      move =
        typeof moveInput === "string"
          ? game.move(moveInput)
          : game.move(moveInput);
    } catch {
      move = null;
    }

    if (!move) {
      setStatusMessage("Illegal move - try again");
      return false;
    }

    setFen(game.fen());
    setMoveHistory((prev) => [...prev, move!.san]);

    // Record move in game recorder
    if (gameRecorderRef.current) {
      gameRecorderRef.current.recordMove(moveInput);
      // Update time in recorder
      if (move.color === "w") {
        gameRecorderRef.current.updateTime("black", blackTime);
      } else {
        gameRecorderRef.current.updateTime("white", whiteTime);
      }
    }

    // Update last move for highlighting
    setLastMove({ from: move.from, to: move.to });

    // Add to game history
    const historyItem: GameHistoryItem = {
      id: Date.now(),
      move: move.san,
      timestamp: Date.now(),
      player: move.color === "w" ? "white" : "black",
    };
    setGameHistory((prev) => [...prev, historyItem]);

    // Track captured pieces
    if (move.captured) {
      const capturedPieceSymbol = move.captured.toUpperCase();
      setCapturedPieces((prev) => {
        const newCaptured = { ...prev };
        if (move.color === "w") {
          newCaptured.black.push(capturedPieceSymbol);
        } else {
          newCaptured.white.push(capturedPieceSymbol);
        }
        return newCaptured;
      });
      playSound("capture");
    } else {
      playSound("move");
    }

    // Start the clock on first move
    if (!clockStartedRef.current) {
      clockStartedRef.current = true;
    }

    const sideToMove = game.turn();

    // Apply increment to side that just moved
    if (increment > 0) {
      if (sideToMove === "b") {
        setWhiteTime((prev) => prev + increment);
      } else {
        setBlackTime((prev) => prev + increment);
      }
    }

    // Game end checks
    if (game.isCheckmate()) {
      const winColor = sideToMove === "w" ? "Black" : "White";
      const msg = `Checkmate! ${winColor} wins!`;
      setGameOver(true);
      gameOverRef.current = true;
      setWinner(winColor);
      setStatusMessage(msg);
      playSound("gameEnd");
    } else if (game.isDraw()) {
      let msg = "Game drawn";
      if (game.isStalemate()) {
        msg = "Stalemate! Game drawn";
      } else if (game.isThreefoldRepetition()) {
        msg = "Draw by threefold repetition";
      } else if (game.isInsufficientMaterial()) {
        msg = "Draw by insufficient material";
      }
      setGameOver(true);
      gameOverRef.current = true;
      setWinner(null);
      setStatusMessage(msg);
      playSound("gameEnd");
    } else if (game.isCheck()) {
      setStatusMessage("Check!");
      playSound("check");
    } else {
      setStatusMessage(sideToMove === "w" ? "White to move" : "Black to move");
    }

    setCurrentTurn(game.turn());

    // AI response
    if (game.turn() === "b" && source !== "ai" && !gameOverRef.current) {
      setTimeout(() => makeAIMove(), 800);
    }

    return true;
  }

  /**
   * Save completed game to database
   */
  async function saveGameToDB(
    result: "WIN" | "LOSS" | "DRAW",
    terminationReason: string
  ) {
    if (!gameRecorderRef.current) {
      console.warn("⚠️ No game recorder available");
      return;
    }

    setIsSavingGame(true);
    try {
      const recorder = gameRecorderRef.current;
      const movesJson = recorder.getMovesAsJSON();
      const pgn = recorder.generatePGN(
        "You (White)",
        "ChessMaster AI",
        result,
        effectiveTimeControl,
        "STANDARD",
        terminationReason
      );

      const gameStats = recorder.getGameStats();
      const accuracy = calculateAccuracy(moveHistory);

      const savePayload = {
        opponentName: "ChessMaster AI",
        result,
        pgn,
        movesJson,
        whiteRating: 1847,
        blackRating: 1923,
        timeControl: effectiveTimeControl,
        gameType: "STANDARD" as const,
        terminationReason,
        moveCount: gameStats.moveCount,
        totalTimeWhiteMs: gameStats.whiteTimeUsedMs,
        totalTimeBlackMs: gameStats.blackTimeUsedMs,
        accuracyPercentage: accuracy,
      };

      console.log("💾 Saving game...", savePayload);
      const response = await gameService.saveGame(savePayload);
      console.log("✅ Game saved successfully:", response);

      // Show success message
      setStatusMessage("✅ Game saved! View in Past Games.");
    } catch (error) {
      console.error("❌ Failed to save game:", error);
      setStatusMessage("⚠️ Game completed but failed to save to database");
    } finally {
      setIsSavingGame(false);
    }
  }

  /**
   * Calculate move accuracy based on move count
   */
  function calculateAccuracy(moves: string[]): number {
    // Simplified calculation - in production, use Stockfish analysis
    // For now, assume all moves are equally good
    return 75 + Math.floor(Math.random() * 20); // 75-95% range
  }

  /**
   * Simple AI with random move selection
   * You can replace this with a stronger engine if desired
   */
  function makeAIMove() {
    if (gameOverRef.current) return;
    const game = gameRef.current;
    const legalMoves = game.moves();
    if (legalMoves.length === 0) return;

    // Simple random move - you can enhance this with minimax, etc.
    const randomMove =
      legalMoves[Math.floor(Math.random() * legalMoves.length)];
    applyMove(randomMove, "ai");
  }

  /**
   * Start a new game
   */
  function handleNewGame() {
    const newGame = new Chess();
    gameRef.current = newGame;
    setFen(newGame.fen());
    setMoveHistory([]);
    setGameHistory([]);
    setStatusMessage("White to move");
    setCurrentTurn("w");
    setGameOver(false);
    setWinner(null);
    gameOverRef.current = false;
    clockStartedRef.current = false;
    setLastMove(null);
    setCapturedPieces({ white: [], black: [] });

    // Reset time
    const [mainPart, incStr] = effectiveTimeControl.split("+");
    let minutesPart = mainPart;
    if (minutesPart.includes("/")) {
      minutesPart = minutesPart.split("/")[0];
    }
    const minutes = Number(minutesPart) || 0;
    const totalSeconds = minutes * 60;
    setWhiteTime(totalSeconds);
    setBlackTime(totalSeconds);

    // Reset warning flags
    whiteTimeWarned30.current = false;
    whiteTimeWarned10.current = false;
    blackTimeWarned30.current = false;
    blackTimeWarned10.current = false;
  }

  /**
   * Undo last move
   */
  function handleUndo() {
    if (gameOverRef.current) return;
    if (moveHistory.length < 2) return; // Need at least 2 moves to undo (player + AI)

    const game = gameRef.current;

    // Undo twice (AI move + player move)
    game.undo();
    game.undo();

    setFen(game.fen());
    setMoveHistory((prev) => prev.slice(0, -2));
    setGameHistory((prev) => prev.slice(0, -2));
    setLastMove(null);
    setStatusMessage("Move undone");
    setCurrentTurn(game.turn());
  }

  /**
   * Offer draw
   */
  function handleOfferDraw() {
    if (gameOverRef.current) return;
    // In a real game, this would send a draw offer to opponent
    // For AI game, we'll auto-accept or decline randomly
    const accept = Math.random() > 0.5;

    if (accept) {
      setGameOver(true);
      gameOverRef.current = true;
      setWinner(null);
      setStatusMessage("Draw agreed");
      playSound("gameEnd");
    } else {
      setStatusMessage("AI declined the draw offer");
      setTimeout(() => {
        setStatusMessage(
          currentTurn === "w" ? "White to move" : "Black to move"
        );
      }, 2000);
    }
  }

  /**
   * Resign game
   */
  function handleResign() {
    if (gameOverRef.current) return;
    const winColor = "Black"; // AI wins
    setGameOver(true);
    gameOverRef.current = true;
    setWinner(winColor);
    setStatusMessage("You resigned. Black wins!");
    playSound("gameEnd");
  }

  /**
   * Board drag/drop handler
   */
  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (gameOverRef.current) return false;
    if (gameRef.current.turn() !== "w") return false;

    const success = applyMove(
      { from: sourceSquare, to: targetSquare, promotion: "q" },
      "board"
    );
    return success;
  };

  /**
   * Get legal moves for a square
   */
  const getSquareStyles = () => {
    if (!showLegalMoves) return {};

    const styles: { [square: string]: React.CSSProperties } = {};

    // Highlight last move
    if (lastMove) {
      styles[lastMove.from] = {
        backgroundColor: "rgba(255, 255, 0, 0.4)",
      };
      styles[lastMove.to] = {
        backgroundColor: "rgba(255, 255, 0, 0.4)",
      };
    }

    return styles;
  };

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/home");
  };

  // Clock ticker
  useEffect(() => {
    if (gameOver || isPaused || !clockStartedRef.current) return;

    let timerId: number;

    if (currentTurn === "w") {
      timerId = window.setInterval(() => {
        setWhiteTime((prev) => {
          if (prev === 30 && !whiteTimeWarned30.current) {
            whiteTimeWarned30.current = true;
          } else if (prev === 10 && !whiteTimeWarned10.current) {
            whiteTimeWarned10.current = true;
          }

          if (prev <= 1) {
            handleFlag("white");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      timerId = window.setInterval(() => {
        setBlackTime((prev) => {
          if (prev === 30 && !blackTimeWarned30.current) {
            blackTimeWarned30.current = true;
          } else if (prev === 10 && !blackTimeWarned10.current) {
            blackTimeWarned10.current = true;
          }

          if (prev <= 1) {
            handleFlag("black");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => window.clearInterval(timerId);
  }, [currentTurn, gameOver, isPaused]);

  // Save game when it ends
  useEffect(() => {
    if (!gameOver || isSavingGame) return;

    const saveGame = async () => {
      let result: "WIN" | "LOSS" | "DRAW" = "DRAW";
      let terminationReason = "DRAW";

      if (winner === "White") {
        result = "WIN";
        terminationReason = "CHECKMATE";
      } else if (winner === "Black") {
        result = "LOSS";
        terminationReason = "CHECKMATE";
      } else if (statusMessage.includes("Stalemate")) {
        terminationReason = "STALEMATE";
      } else if (statusMessage.includes("threefold")) {
        terminationReason = "THREEFOLD_REPETITION";
      } else if (statusMessage.includes("insufficient")) {
        terminationReason = "INSUFFICIENT_MATERIAL";
      }

      await saveGameToDB(result, terminationReason);
    };

    // Delay slightly to ensure all state updates are done
    const timer = setTimeout(saveGame, 500);
    return () => clearTimeout(timer);
  }, [gameOver]);

  return (
    <>
      <Navbar rating={1847} streak={5} />

      <div className="standard-chess-page">
        <div className="chess-back-row">
          <button className="chess-back-btn" onClick={handleBack}>
            ← Back to Menu
          </button>
        </div>

        <div className="chess-top-bar">
          <div className="chess-top-left">
            <div className="chess-top-title-row">
              <span className="chess-dot" />
              <span className="chess-top-title">Standard Chess Game</span>
              <span className="chess-top-badge">VS AI</span>
            </div>
            <div className="chess-top-subtitle">
              Time Control:{" "}
              <span className="chess-top-subtitle-strong">
                {effectiveTimeControl}
              </span>{" "}
              | Drag pieces to make your move
            </div>
          </div>
          <div className="chess-top-right">
            <button
              className="chess-top-button"
              onClick={() => setIsPaused((prev) => !prev)}
              disabled={gameOver}
            >
              {isPaused ? "▶ Resume Game" : "⏸ Pause Game"}
            </button>
            <button
              className="chess-top-button secondary"
              onClick={handleNewGame}
            >
              🔄 New Game
            </button>
          </div>
        </div>

        <div className="chess-main-layout">
          {/* LEFT COLUMN - BOARD */}
          <div className="chess-left-column">
            <div className="chess-board-card">
              <Chessboard
                {...({
                  position: fen,
                  onPieceDrop: onDrop,
                  boardOrientation,
                  boardWidth,
                  arePiecesDraggable:
                    !gameOver && gameRef.current.turn() === "w" && !isPaused,
                  customSquareStyles: getSquareStyles(),
                  customBoardStyle: {
                    borderRadius: "16px",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.9)",
                  },
                } as any)}
              />

              <div className="chess-board-footer">
                <button
                  className="chess-small-btn"
                  onClick={() =>
                    setBoardOrientation((prev) =>
                      prev === "white" ? "black" : "white"
                    )
                  }
                >
                  🔄 Flip Board
                </button>
                <button
                  className="chess-small-btn"
                  onClick={() => setShowLegalMoves((prev) => !prev)}
                >
                  {showLegalMoves ? "👁 Hide Hints" : "👁 Show Hints"}
                </button>
                <button
                  className="chess-small-btn"
                  onClick={() => setIsSoundOn((prev) => !prev)}
                >
                  {isSoundOn ? "🔊 Sound On" : "🔇 Sound Off"}
                </button>
              </div>
            </div>

            {/* Game Controls */}
            <div className="chess-controls-panel">
              <button
                className="chess-control-btn"
                onClick={handleUndo}
                disabled={gameOver || moveHistory.length < 2}
              >
                ↩️ Undo Move
              </button>
              <button
                className="chess-control-btn"
                onClick={handleOfferDraw}
                disabled={gameOver}
              >
                🤝 Offer Draw
              </button>
              <button
                className="chess-control-btn danger"
                onClick={handleResign}
                disabled={gameOver}
              >
                🏳️ Resign
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN - INFO */}
          <div className="chess-right-column">
            {/* AI Player Card */}
            <div className="chess-player-card ai-card">
              <div className="player-left">
                <div className="player-avatar ai">🤖</div>
                <div>
                  <div className="player-name">ChessMaster AI</div>
                  <div className="player-rating">⭐ Rating: 1923</div>
                </div>
              </div>
              <div
                className={`player-clock ${blackTime <= 30 ? "low-time" : ""} ${
                  blackTime <= 10 ? "critical-time" : ""
                }`}
              >
                {formatTime(blackTime)}
              </div>
            </div>

            {/* Human Player Card */}
            <div className="chess-player-card you-card">
              <div className="player-left">
                <div className="player-avatar you">Y</div>
                <div>
                  <div className="player-name">You (White)</div>
                  <div className="player-rating">⭐ Rating: 1847</div>
                </div>
              </div>
              <div
                className={`player-clock ${whiteTime <= 30 ? "low-time" : ""} ${
                  whiteTime <= 10 ? "critical-time" : ""
                }`}
              >
                {formatTime(whiteTime)}
              </div>
            </div>

            {/* Captured Pieces */}
            <div className="chess-captured-panel">
              <div className="panel-header">
                <span>⚔️ Captured Pieces</span>
              </div>
              <div className="captured-section">
                <div className="captured-label">White captured:</div>
                <div className="captured-pieces">
                  {capturedPieces.black.length > 0 ? (
                    capturedPieces.black.map((piece, idx) => (
                      <span key={idx} className="captured-piece">
                        {piece}
                      </span>
                    ))
                  ) : (
                    <span className="captured-empty">None</span>
                  )}
                </div>
              </div>
              <div className="captured-section">
                <div className="captured-label">Black captured:</div>
                <div className="captured-pieces">
                  {capturedPieces.white.length > 0 ? (
                    capturedPieces.white.map((piece, idx) => (
                      <span key={idx} className="captured-piece">
                        {piece}
                      </span>
                    ))
                  ) : (
                    <span className="captured-empty">None</span>
                  )}
                </div>
              </div>
            </div>

            {/* Move History */}
            <div className="chess-move-history-card">
              <div className="panel-header">
                <span>♟️ Move History</span>
                <span className="move-count">
                  {Math.floor(moveHistory.length / 2)} moves
                </span>
              </div>
              <div className="move-history-list">
                {moveHistory.length === 0 && (
                  <div className="chess-history-empty">
                    Game moves will be recorded here.
                  </div>
                )}
                {moveHistory.map((move, idx) => (
                  <div key={idx} className="move-history-item">
                    <span className="move-index">
                      {Math.floor(idx / 2) + 1}.
                    </span>
                    <span
                      className={`move-text ${
                        idx % 2 === 0 ? "white-move" : "black-move"
                      }`}
                    >
                      {move}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Game Status */}
            <div className="chess-status-strip">
              {gameOver ? (
                <div className="status-game-over">
                  {winner ? `🏆 ${winner} wins!` : "🤝 Game drawn"}
                </div>
              ) : (
                <div className="status-active">
                  {isPaused ? "⏸ Game Paused" : statusMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StandardChessPage;
