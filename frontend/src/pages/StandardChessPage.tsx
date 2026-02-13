import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Chess, Move } from "chess.js";
import { Chessboard } from "react-chessboard";
import Navbar from "../components/Navbar/Navbar";
import "./StandardChessPage.css";
import gameService from "../api/games";
import { GameRecorder } from "../utils/gameRecorder";
import { stockfishService } from "../utils/stockfishService";
import { getAccessToken } from "../utils/getAccessToken";

// ---------- Types ----------
interface StandardChessPageProps {
  timeControl?: string;
}

interface MultiplayerState {
  gameId: string;
  color: "white" | "black";
  timeControl: string;
  opponentName: string;
  whitePlayer: string;
  blackPlayer: string;
  whitePlayerId: number;
  blackPlayerId: number;
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
  const routeState = location.state as
    | ({ timeControl?: string } & Partial<MultiplayerState>)
    | null;

  // ── Multiplayer detection ──────────────────────────────────────────────────
  const isMultiplayer = !!(routeState as MultiplayerState)?.gameId;
  const mpState = isMultiplayer ? (routeState as MultiplayerState) : null;
  const wsRef = useRef<WebSocket | null>(null);
  const myColor = mpState?.color ?? "white"; // in solo always white

  const [effectiveTimeControl, setEffectiveTimeControl] =
    useState<string>(timeControl);

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(
    myColor
  );

  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [gameHistory, setGameHistory] = useState<GameHistoryItem[]>([]);
  const [statusMessage, setStatusMessage] = useState(
    isMultiplayer ? "Waiting for opponent..." : "White to move"
  );
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

  // Multiplayer-specific UI
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [mpConnectionStatus, setMpConnectionStatus] = useState<
    "connecting" | "waiting" | "playing" | "disconnected"
  >("connecting");

  // Game state refs
  const clockStartedRef = useRef(false);
  const gameOverRef = useRef(false);
  const isSoundOnRef = useRef(true);
  const incrementRef = useRef(0);
  const currentTurnRef = useRef<"w" | "b">("w");
  const myColorRef = useRef<"white" | "black">(myColor);

  // Time warning flags
  const whiteTimeWarned30 = useRef(false);
  const whiteTimeWarned10 = useRef(false);
  const blackTimeWarned30 = useRef(false);
  const blackTimeWarned10 = useRef(false);

  // Game recorder for saving game data (solo only)
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

  useEffect(() => {
    currentTurnRef.current = currentTurn;
  }, [currentTurn]);

  useEffect(() => {
    incrementRef.current = increment;
  }, [increment]);

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
      } catch { /* ignore */ }
    }
    setEffectiveTimeControl(tc || timeControl || "10+0");
  }, [routeState, timeControl]);

  // Init time control
  useEffect(() => {
    const [mainPart, incStr] = effectiveTimeControl.split("+");
    let minutesPart = mainPart;
    if (minutesPart.includes("/")) minutesPart = minutesPart.split("/")[0];
    const minutes = Number(minutesPart) || 0;
    const inc = Number(incStr) || 0;
    const totalSeconds = minutes * 60;
    setWhiteTime(totalSeconds);
    setBlackTime(totalSeconds);
    setIncrement(inc);
    incrementRef.current = inc;
    clockStartedRef.current = false;
    whiteTimeWarned30.current = false;
    whiteTimeWarned10.current = false;
    blackTimeWarned30.current = false;
    blackTimeWarned10.current = false;
  }, [effectiveTimeControl]);

  // Initialize game recorder (solo only)
  useEffect(() => {
    if (!isMultiplayer) {
      gameRecorderRef.current = new GameRecorder(effectiveTimeControl);
    }
  }, [effectiveTimeControl, isMultiplayer]);

  // Initialize Stockfish AI (solo only)
  useEffect(() => {
    if (isMultiplayer) return;
    const initStockfish = async () => {
      try {
        await stockfishService.initialize();
      } catch (error) {
        console.error("❌ Failed to initialize Stockfish:", error);
      }
    };
    initStockfish();
    return () => { stockfishService.terminate(); };
  }, [isMultiplayer]);

  // ── Multiplayer WebSocket ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isMultiplayer || !mpState?.gameId) return;

    let cancelled = false;

    const connect = async () => {
      const token = await getAccessToken();
      if (!token || cancelled) return;

      const wsUrl = `ws://localhost:8080/api/game/${mpState.gameId}?token=${token}&gameId=${mpState.gameId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setMpConnectionStatus("connecting");

      ws.onopen = () => {
        console.log("🎮 Game WS connected");
        setMpConnectionStatus("waiting");
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          handleServerMessage(JSON.parse(event.data));
        } catch (e) {
          console.error("Failed to parse WS message:", e);
        }
      };

      ws.onerror = (err) => {
        console.error("❌ Game WS error:", err);
        setMpConnectionStatus("disconnected");
      };

      ws.onclose = () => {
        console.log("🔌 Game WS closed");
        if (!gameOverRef.current) {
          setMpConnectionStatus("disconnected");
          setStatusMessage("Connection lost");
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (wsRef.current) wsRef.current.close();
    };
  }, [isMultiplayer, mpState?.gameId]);

  // ── Handle incoming WebSocket messages ────────────────────────────────────
  const handleServerMessage = useCallback(
    (data: any) => {
      switch (data.type) {
        case "GAME_START": {
          gameRef.current = new Chess();
          setFen(gameRef.current.fen());
          clockStartedRef.current = true;
          setCurrentTurn("w");
          currentTurnRef.current = "w";
          setMpConnectionStatus("playing");
          setStatusMessage(
            myColorRef.current === "white" ? "Your turn" : "Opponent's turn"
          );
          break;
        }

        case "WAITING_FOR_OPPONENT": {
          setMpConnectionStatus("waiting");
          setStatusMessage("Waiting for opponent to connect...");
          break;
        }

        case "MOVE": {
          // Opponent's move arrives — apply it to the board
          const game = gameRef.current;
          try {
            const move = game.move({
              from: data.from,
              to: data.to,
              promotion: data.promotion || "q",
            });
            if (move) {
              setFen(game.fen());
              setLastMove({ from: data.from, to: data.to });
              setMoveHistory((prev) => [...prev, move.san]);

              const historyItem: GameHistoryItem = {
                id: Date.now(),
                move: move.san,
                timestamp: Date.now(),
                player: move.color === "w" ? "white" : "black",
              };
              setGameHistory((prev) => [...prev, historyItem]);

              if (move.captured) {
                const sym = move.captured.toUpperCase();
                setCapturedPieces((prev) => {
                  const n = { ...prev };
                  if (move.color === "w") n.black.push(sym);
                  else n.white.push(sym);
                  return n;
                });
              }

              const nextTurn = data.turn as "white" | "black";
              const nextTurnChar = nextTurn === "white" ? "w" : "b";
              setCurrentTurn(nextTurnChar);
              currentTurnRef.current = nextTurnChar;

              // Apply increment to player who just moved
              const movedColor = data.player as "white" | "black";
              if (incrementRef.current > 0) {
                if (movedColor === "white")
                  setWhiteTime((p) => p + incrementRef.current);
                else setBlackTime((p) => p + incrementRef.current);
              }

              if (game.isCheckmate()) {
                const winner = movedColor;
                setGameOver(true);
                gameOverRef.current = true;
                const iWin = winner === myColorRef.current;
                setGameResult(iWin ? "You win! by checkmate" : "You lose! by checkmate");
                setStatusMessage("Checkmate!");
              } else if (game.isDraw()) {
                setGameOver(true);
                gameOverRef.current = true;
                setGameResult("Draw!");
                setStatusMessage("Game drawn");
              } else if (game.isCheck()) {
                setStatusMessage("Check!");
              } else {
                setStatusMessage(
                  nextTurn === myColorRef.current
                    ? "Your turn"
                    : "Opponent's turn"
                );
              }
            }
          } catch (e) {
            console.error("❌ Error applying opponent move:", e);
          }
          break;
        }

        case "GAME_OVER": {
          setGameOver(true);
          gameOverRef.current = true;
          if (data.result === "DRAW") {
            setGameResult(`Draw by ${(data.reason || "").toLowerCase()}`);
            setWinner(null);
          } else {
            const iWin =
              (data.winner === "white" && myColorRef.current === "white") ||
              (data.winner === "black" && myColorRef.current === "black");
            setGameResult(iWin ? "You win!" : "You lose!");
            setWinner(iWin ? "You" : "Opponent");
          }
          setStatusMessage(data.reason || "Game over");
          break;
        }

        case "DRAW_OFFER": {
          setDrawOfferReceived(true);
          setStatusMessage("Opponent offers a draw");
          break;
        }

        case "DRAW_DECLINED": {
          setStatusMessage("Draw offer declined");
          setTimeout(
            () =>
              setStatusMessage(
                currentTurnRef.current === (myColorRef.current === "white" ? "w" : "b")
                  ? "Your turn"
                  : "Opponent's turn"
              ),
            2000
          );
          break;
        }

        case "OPPONENT_DISCONNECTED": {
          setStatusMessage("Opponent disconnected");
          setMpConnectionStatus("disconnected");
          break;
        }
      }
    },
    [] // myColorRef is a ref so no dep needed
  );

  // ── WebSocket send helper ──────────────────────────────────────────────────
  const sendMessage = (msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  // ---------- Sound Effects ----------
  const playSound = (soundType: "move" | "capture" | "check" | "gameEnd") => {
    if (!isSoundOnRef.current) return;
    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      switch (soundType) {
        case "move":    oscillator.frequency.value = 400; gainNode.gain.value = 0.1;  break;
        case "capture": oscillator.frequency.value = 300; gainNode.gain.value = 0.15; break;
        case "check":   oscillator.frequency.value = 600; gainNode.gain.value = 0.2;  break;
        case "gameEnd": oscillator.frequency.value = 500; gainNode.gain.value = 0.15; break;
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
    setGameOver(true);
    gameOverRef.current = true;
    setWinner(winColor);
    setStatusMessage(`Time's up! ${winColor} wins on time!`);
    playSound("gameEnd");
    if (isMultiplayer) sendMessage({ type: "FLAG" });
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  /**
   * Apply move — handles both solo (AI game) and multiplayer
   */
  function applyMove(
    moveInput: string | { from: string; to: string; promotion?: string },
    source: "board" | "ai"
  ): boolean {
    if (gameOverRef.current) return false;

    const game = gameRef.current;
    let move: Move | null = null;
    try {
      move = typeof moveInput === "string" ? game.move(moveInput) : game.move(moveInput);
    } catch { move = null; }

    if (!move) {
      setStatusMessage("Illegal move - try again");
      return false;
    }

    setFen(game.fen());
    setMoveHistory((prev) => [...prev, move!.san]);
    setLastMove({ from: move.from, to: move.to });

    const historyItem: GameHistoryItem = {
      id: Date.now(),
      move: move.san,
      timestamp: Date.now(),
      player: move.color === "w" ? "white" : "black",
    };
    setGameHistory((prev) => [...prev, historyItem]);

    if (move.captured) {
      const sym = move.captured.toUpperCase();
      setCapturedPieces((prev) => {
        const n = { ...prev };
        if (move!.color === "w") n.black.push(sym);
        else n.white.push(sym);
        return n;
      });
    }

    // Solo: record in game recorder
    if (!isMultiplayer && gameRecorderRef.current) {
      gameRecorderRef.current.recordMove(moveInput);
      if (move.color === "w") gameRecorderRef.current.updateTime("black", blackTime);
      else gameRecorderRef.current.updateTime("white", whiteTime);
    }

    if (!clockStartedRef.current) clockStartedRef.current = true;

    const sideToMove = game.turn();

    // Apply increment
    if (increment > 0) {
      if (sideToMove === "b") setWhiteTime((prev) => prev + increment);
      else setBlackTime((prev) => prev + increment);
    }

    // Multiplayer: send move over WebSocket
    if (isMultiplayer && source === "board") {
      const nextTurnColor = sideToMove === "w" ? "white" : "black";
      sendMessage({
        type: "MOVE",
        from: move.from,
        to: move.to,
        promotion: move.promotion || null,
        san: move.san,
        fen: game.fen(),
        turn: nextTurnColor,
        player: myColorRef.current,
      });
    }

    // Game end checks
    if (game.isCheckmate()) {
      const winColor = sideToMove === "w" ? "Black" : "White";
      setGameOver(true);
      gameOverRef.current = true;
      setWinner(winColor);
      setStatusMessage(`Checkmate! ${winColor} wins!`);
      if (isMultiplayer) {
        const iWin = winColor.toLowerCase() === myColorRef.current;
        setGameResult(iWin ? "You win! by checkmate" : "You lose! by checkmate");
      }
      playSound("gameEnd");
    } else if (game.isDraw()) {
      let msg = "Game drawn";
      if (game.isStalemate()) msg = "Stalemate! Game drawn";
      else if (game.isThreefoldRepetition()) msg = "Draw by threefold repetition";
      else if (game.isInsufficientMaterial()) msg = "Draw by insufficient material";
      setGameOver(true);
      gameOverRef.current = true;
      setWinner(null);
      setStatusMessage(msg);
      if (isMultiplayer) setGameResult("Draw!");
      playSound("gameEnd");
    } else if (game.isCheck()) {
      setStatusMessage(
        isMultiplayer
          ? sideToMove === (myColorRef.current === "white" ? "w" : "b")
            ? "Check! Your turn"
            : "Check! Opponent's turn"
          : "Check!"
      );
      playSound("check");
    } else {
      if (isMultiplayer) {
        setStatusMessage(
          sideToMove === (myColorRef.current === "white" ? "w" : "b")
            ? "Opponent's turn"
            : "Your turn"
        );
      } else {
        setStatusMessage(sideToMove === "w" ? "White to move" : "Black to move");
      }
    }

    setCurrentTurn(game.turn());
    currentTurnRef.current = game.turn();

    // Solo AI response
    if (!isMultiplayer && game.turn() === "b" && source !== "ai" && !gameOverRef.current) {
      setTimeout(() => makeAIMove(), 800);
    }

    return true;
  }

  // Solo: save completed game to database
  async function saveGameToDB(result: "WIN" | "LOSS" | "DRAW", terminationReason: string) {
    if (!gameRecorderRef.current) return;
    setIsSavingGame(true);
    try {
      const recorder = gameRecorderRef.current;
      const validation = recorder.validateMoves();
      if (!validation.valid) {
        setStatusMessage(`❌ Error: ${validation.message}`);
        return;
      }
      const movesJson = recorder.getMovesAsJSON();
      const pgn = recorder.generatePGN(
        "You (White)", "ChessMaster AI", result,
        effectiveTimeControl, "STANDARD", terminationReason
      );
      const gameStats = recorder.getGameStats();
      const accuracy = 75 + Math.floor(Math.random() * 20);
      await gameService.saveGame({
        opponentName: "ChessMaster AI",
        result, pgn, movesJson,
        whiteRating: 1847, blackRating: 1923,
        timeControl: effectiveTimeControl,
        gameType: "STANDARD" as const,
        terminationReason,
        moveCount: gameStats.moveCount,
        totalTimeWhiteMs: gameStats.whiteTimeUsedMs,
        totalTimeBlackMs: gameStats.blackTimeUsedMs,
        accuracyPercentage: accuracy,
      });
      setStatusMessage("✅ Game saved! View in Past Games.");
    } catch (error) {
      console.error("❌ Failed to save game:", error);
      setStatusMessage("⚠️ Game completed but failed to save");
    } finally {
      setIsSavingGame(false);
    }
  }

  // Solo AI move
  async function makeAIMove() {
    if (gameOverRef.current || isMultiplayer) return;
    const game = gameRef.current;
    try {
      const move = await stockfishService.getBestMove(game.fen(), 3);
      if (move) applyMove(move, "ai");
      else makeRandomMove();
    } catch { makeRandomMove(); }
  }

  function makeRandomMove() {
    const game = gameRef.current;
    const legalMoves = game.moves();
    if (legalMoves.length === 0) return;
    applyMove(legalMoves[Math.floor(Math.random() * legalMoves.length)], "ai");
  }

  function handleNewGame() {
    if (isMultiplayer) return; // no new game in multiplayer
    const newGame = new Chess();
    gameRef.current = newGame;
    setFen(newGame.fen());
    setMoveHistory([]);
    setGameHistory([]);
    setStatusMessage("White to move");
    setCurrentTurn("w");
    currentTurnRef.current = "w";
    setGameOver(false);
    setWinner(null);
    gameOverRef.current = false;
    clockStartedRef.current = false;
    setLastMove(null);
    setCapturedPieces({ white: [], black: [] });
    const [mainPart, incStr] = effectiveTimeControl.split("+");
    let minutesPart = mainPart;
    if (minutesPart.includes("/")) minutesPart = minutesPart.split("/")[0];
    const minutes = Number(minutesPart) || 0;
    setWhiteTime(minutes * 60);
    setBlackTime(minutes * 60);
    whiteTimeWarned30.current = false;
    whiteTimeWarned10.current = false;
    blackTimeWarned30.current = false;
    blackTimeWarned10.current = false;
  }

  function handleUndo() {
    if (gameOverRef.current || isMultiplayer) return;
    if (moveHistory.length < 2) return;
    const game = gameRef.current;
    game.undo();
    game.undo();
    setFen(game.fen());
    setMoveHistory((prev) => prev.slice(0, -2));
    setGameHistory((prev) => prev.slice(0, -2));
    setLastMove(null);
    setStatusMessage("Move undone");
    setCurrentTurn(game.turn());
    currentTurnRef.current = game.turn();
  }

  function handleOfferDraw() {
    if (gameOverRef.current) return;
    if (isMultiplayer) {
      sendMessage({ type: "OFFER_DRAW" });
      setStatusMessage("Draw offer sent...");
    } else {
      const accept = Math.random() > 0.5;
      if (accept) {
        setGameOver(true);
        gameOverRef.current = true;
        setWinner(null);
        setStatusMessage("Draw agreed");
        playSound("gameEnd");
      } else {
        setStatusMessage("AI declined the draw offer");
        setTimeout(() => setStatusMessage(currentTurn === "w" ? "White to move" : "Black to move"), 2000);
      }
    }
  }

  function handleResign() {
    if (gameOverRef.current) return;
    if (isMultiplayer) {
      if (confirm("Are you sure you want to resign?")) {
        sendMessage({ type: "RESIGN" });
      }
    } else {
      setGameOver(true);
      gameOverRef.current = true;
      setWinner("Black");
      setStatusMessage("You resigned. Black wins!");
      playSound("gameEnd");
    }
  }

  function handleAcceptDraw() {
    sendMessage({ type: "ACCEPT_DRAW" });
    setDrawOfferReceived(false);
  }

  function handleDeclineDraw() {
    sendMessage({ type: "DECLINE_DRAW" });
    setDrawOfferReceived(false);
  }

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (gameOverRef.current) return false;
    // Solo: only white can move; Multiplayer: only your color can move
    if (isMultiplayer) {
      const myTurn = myColorRef.current === "white" ? "w" : "b";
      if (gameRef.current.turn() !== myTurn) return false;
    } else {
      if (gameRef.current.turn() !== "w") return false;
    }
    return applyMove({ from: sourceSquare, to: targetSquare, promotion: "q" }, "board");
  };

  const getSquareStyles = () => {
    if (!showLegalMoves) return {};
    const styles: { [square: string]: React.CSSProperties } = {};
    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: "rgba(255, 255, 0, 0.4)" };
      styles[lastMove.to]   = { backgroundColor: "rgba(255, 255, 0, 0.4)" };
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
          if (prev === 30 && !whiteTimeWarned30.current) whiteTimeWarned30.current = true;
          if (prev === 10 && !whiteTimeWarned10.current) whiteTimeWarned10.current = true;
          if (prev <= 1) { handleFlag("white"); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      timerId = window.setInterval(() => {
        setBlackTime((prev) => {
          if (prev === 30 && !blackTimeWarned30.current) blackTimeWarned30.current = true;
          if (prev === 10 && !blackTimeWarned10.current) blackTimeWarned10.current = true;
          if (prev <= 1) { handleFlag("black"); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => window.clearInterval(timerId);
  }, [currentTurn, gameOver, isPaused]);

  // Multiplayer: send periodic time updates
  useEffect(() => {
    if (!isMultiplayer || !clockStartedRef.current || gameOver) return;
    const timer = window.setInterval(() => {
      sendMessage({ type: "TIME_UPDATE", whiteMs: whiteTime * 1000, blackMs: blackTime * 1000 });
    }, 5000);
    return () => clearInterval(timer);
  }, [isMultiplayer, whiteTime, blackTime, gameOver]);

  // Solo: save game when it ends
  useEffect(() => {
    if (!gameOver || isSavingGame || isMultiplayer) return;
    const saveGame = async () => {
      let result: "WIN" | "LOSS" | "DRAW" = "DRAW";
      let terminationReason = "DRAW";
      if (winner === "White") { result = "WIN"; terminationReason = "CHECKMATE"; }
      else if (winner === "Black") { result = "LOSS"; terminationReason = "CHECKMATE"; }
      else if (statusMessage.includes("Stalemate")) terminationReason = "STALEMATE";
      else if (statusMessage.includes("threefold")) terminationReason = "THREEFOLD_REPETITION";
      else if (statusMessage.includes("insufficient")) terminationReason = "INSUFFICIENT_MATERIAL";
      await saveGameToDB(result, terminationReason);
    };
    const timer = setTimeout(saveGame, 500);
    return () => clearTimeout(timer);
  }, [gameOver]);

  // ── Derived display values ─────────────────────────────────────────────────
  const opponentName = mpState?.opponentName || "Opponent";
  const opponentPlayer = myColor === "white" ? mpState?.blackPlayer : mpState?.whitePlayer;
  const opponentClock = myColor === "white" ? blackTime : whiteTime;
  const myClock = myColor === "white" ? whiteTime : blackTime;

  const isDraggable = isMultiplayer
    ? !gameOver && gameRef.current.turn() === (myColor === "white" ? "w" : "b") && !isPaused
    : !gameOver && gameRef.current.turn() === "w" && !isPaused;

  return (
    <>
      <Navbar rating={1847} streak={5} />

      <div className="standard-chess-page">
        <div className="chess-back-row">
          <button className="chess-back-btn" onClick={handleBack}>
            ← Back to Menu
          </button>
          {isMultiplayer && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span className="chess-top-badge" style={{
                background: mpConnectionStatus === "playing" ? "rgba(0,200,100,0.2)"
                  : mpConnectionStatus === "waiting" ? "rgba(255,200,0,0.2)"
                  : "rgba(255,80,80,0.2)",
                color: mpConnectionStatus === "playing" ? "#00c864"
                  : mpConnectionStatus === "waiting" ? "#ffc800"
                  : "#ff5050",
                border: `1px solid currentColor`,
                padding: "4px 12px",
                borderRadius: "20px",
                fontSize: "0.8rem",
                fontWeight: 600,
              }}>
                {mpConnectionStatus === "playing" ? "● Live"
                  : mpConnectionStatus === "waiting" ? "⏳ Waiting"
                  : mpConnectionStatus === "connecting" ? "⟳ Connecting"
                  : "✕ Disconnected"}
              </span>
              <span style={{ color: "#888", fontSize: "0.85rem" }}>
                ⏱ {effectiveTimeControl}
              </span>
            </div>
          )}
        </div>

        <div className="chess-top-bar">
          <div className="chess-top-left">
            <div className="chess-top-title-row">
              <span className="chess-dot" />
              <span className="chess-top-title">
                {isMultiplayer ? "Multiplayer Chess" : "Standard Chess Game"}
              </span>
              <span className="chess-top-badge">
                {isMultiplayer ? "VS Player" : "VS AI"}
              </span>
            </div>
            <div className="chess-top-subtitle">
              {isMultiplayer ? (
                <>You are playing as <strong style={{ color: myColor === "white" ? "#fff" : "#aaa" }}>{myColor}</strong> — {statusMessage}</>
              ) : (
                <>Time Control: <span className="chess-top-subtitle-strong">{effectiveTimeControl}</span> | Drag pieces to make your move</>
              )}
            </div>
          </div>
          <div className="chess-top-right">
            {!isMultiplayer && (
              <>
                <button className="chess-top-button" onClick={() => setIsPaused((p) => !p)} disabled={gameOver}>
                  {isPaused ? "▶ Resume Game" : "⏸ Pause Game"}
                </button>
                <button className="chess-top-button secondary" onClick={handleNewGame}>
                  🔄 New Game
                </button>
              </>
            )}
          </div>
        </div>

        <div className="chess-main-layout">
          {/* LEFT COLUMN - BOARD */}
          <div className="chess-left-column">
            {/* Opponent player card (shown above board in multiplayer) */}
            {isMultiplayer && (
              <div className={`chess-player-card ${opponentClock <= 30 ? "low-time" : ""}`}
                style={{ marginBottom: "8px" }}>
                <div className="player-left">
                  <div className="player-avatar ai">
                    {(opponentPlayer || opponentName)[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="player-name">{opponentPlayer || opponentName}</div>
                    <div className="player-rating">
                      {myColor === "white" ? "⬛ Black" : "⬜ White"}
                    </div>
                  </div>
                </div>
                <div className={`player-clock ${opponentClock <= 30 ? "low-time" : ""} ${opponentClock <= 10 ? "critical-time" : ""}`}>
                  {formatTime(opponentClock)}
                </div>
              </div>
            )}

            <div className="chess-board-card">
              <Chessboard
                {...({
                  position: fen,
                  onPieceDrop: onDrop,
                  boardOrientation: isMultiplayer ? myColor : boardOrientation,
                  boardWidth,
                  arePiecesDraggable: isDraggable,
                  customSquareStyles: getSquareStyles(),
                  customBoardStyle: {
                    borderRadius: "16px",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.9)",
                  },
                } as any)}
              />

              <div className="chess-board-footer">
                {!isMultiplayer && (
                  <button className="chess-small-btn" onClick={() =>
                    setBoardOrientation((p) => p === "white" ? "black" : "white")}>
                    🔄 Flip Board
                  </button>
                )}
                <button className="chess-small-btn" onClick={() => setShowLegalMoves((p) => !p)}>
                  {showLegalMoves ? "👁 Hide Hints" : "👁 Show Hints"}
                </button>
                <button className="chess-small-btn" onClick={() => setIsSoundOn((p) => !p)}>
                  {isSoundOn ? "🔊 Sound On" : "🔇 Sound Off"}
                </button>
              </div>
            </div>

            {/* My player card (shown below board in multiplayer) */}
            {isMultiplayer && (
              <div className={`chess-player-card you-card ${myClock <= 30 ? "low-time" : ""}`}
                style={{ marginTop: "8px" }}>
                <div className="player-left">
                  <div className="player-avatar you">Y</div>
                  <div>
                    <div className="player-name">You</div>
                    <div className="player-rating">
                      {myColor === "white" ? "⬜ White" : "⬛ Black"}
                    </div>
                  </div>
                </div>
                <div className={`player-clock ${myClock <= 30 ? "low-time" : ""} ${myClock <= 10 ? "critical-time" : ""}`}>
                  {formatTime(myClock)}
                </div>
              </div>
            )}

            {/* Game Controls */}
            <div className="chess-controls-panel">
              {!isMultiplayer && (
                <button className="chess-control-btn" onClick={handleUndo}
                  disabled={gameOver || moveHistory.length < 2}>
                  ↩️ Undo Move
                </button>
              )}
              <button className="chess-control-btn" onClick={handleOfferDraw} disabled={gameOver}>
                🤝 {isMultiplayer ? "Offer Draw" : "Offer Draw"}
              </button>
              <button className="chess-control-btn danger" onClick={handleResign} disabled={gameOver}>
                🏳️ Resign
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN - INFO */}
          <div className="chess-right-column">
            {/* Draw offer banner (multiplayer only) */}
            {isMultiplayer && drawOfferReceived && (
              <div style={{
                background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.4)",
                borderRadius: "12px", padding: "16px", marginBottom: "16px", textAlign: "center",
              }}>
                <p style={{ color: "#ffd700", marginBottom: "12px", fontWeight: 600 }}>
                  🤝 Opponent offers a draw
                </p>
                <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                  <button onClick={handleAcceptDraw} style={{
                    background: "rgba(0,200,100,0.2)", border: "1px solid #00c864",
                    color: "#00c864", padding: "8px 20px", borderRadius: "8px", cursor: "pointer",
                  }}>✓ Accept</button>
                  <button onClick={handleDeclineDraw} style={{
                    background: "rgba(255,80,80,0.2)", border: "1px solid #ff5050",
                    color: "#ff5050", padding: "8px 20px", borderRadius: "8px", cursor: "pointer",
                  }}>✗ Decline</button>
                </div>
              </div>
            )}

            {/* Game over banner (multiplayer) */}
            {isMultiplayer && gameOver && gameResult && (
              <div style={{
                background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.3)",
                borderRadius: "16px", padding: "24px", marginBottom: "16px", textAlign: "center",
              }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>
                  {gameResult.includes("win") ? "🏆" : "🤝"}
                </div>
                <div style={{ color: "#ffd700", fontSize: "1.2rem", fontWeight: 700, marginBottom: "16px" }}>
                  {gameResult}
                </div>
                <button onClick={() => navigate("/home")} style={{
                  background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.4)",
                  color: "#ffd700", padding: "10px 24px", borderRadius: "8px", cursor: "pointer",
                  fontSize: "0.95rem", fontWeight: 600,
                }}>Back to Home</button>
              </div>
            )}

            {/* Solo player cards */}
            {!isMultiplayer && (
              <>
                <div className="chess-player-card ai-card">
                  <div className="player-left">
                    <div className="player-avatar ai">🤖</div>
                    <div>
                      <div className="player-name">ChessMaster AI</div>
                      <div className="player-rating">⭐ Rating: 1923</div>
                    </div>
                  </div>
                  <div className={`player-clock ${blackTime <= 30 ? "low-time" : ""} ${blackTime <= 10 ? "critical-time" : ""}`}>
                    {formatTime(blackTime)}
                  </div>
                </div>
                <div className="chess-player-card you-card">
                  <div className="player-left">
                    <div className="player-avatar you">Y</div>
                    <div>
                      <div className="player-name">You (White)</div>
                      <div className="player-rating">⭐ Rating: 1847</div>
                    </div>
                  </div>
                  <div className={`player-clock ${whiteTime <= 30 ? "low-time" : ""} ${whiteTime <= 10 ? "critical-time" : ""}`}>
                    {formatTime(whiteTime)}
                  </div>
                </div>
              </>
            )}

            {/* Captured Pieces (solo only) */}
            {!isMultiplayer && (
              <div className="chess-captured-panel">
                <div className="panel-header"><span>⚔️ Captured Pieces</span></div>
                <div className="captured-section">
                  <div className="captured-label">White captured:</div>
                  <div className="captured-pieces">
                    {capturedPieces.black.length > 0
                      ? capturedPieces.black.map((p, i) => <span key={i} className="captured-piece">{p}</span>)
                      : <span className="captured-empty">None</span>}
                  </div>
                </div>
                <div className="captured-section">
                  <div className="captured-label">Black captured:</div>
                  <div className="captured-pieces">
                    {capturedPieces.white.length > 0
                      ? capturedPieces.white.map((p, i) => <span key={i} className="captured-piece">{p}</span>)
                      : <span className="captured-empty">None</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Move History */}
            <div className="chess-move-history-card">
              <div className="panel-header">
                <span>♟️ Move History</span>
                <span className="move-count">{Math.ceil(moveHistory.length / 2)} moves</span>
              </div>
              <div className="move-history-list">
                {moveHistory.length === 0 && (
                  <div className="chess-history-empty">Game moves will be recorded here.</div>
                )}
                {Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => (
                  <div key={i} className="move-history-item">
                    <span className="move-index">{i + 1}.</span>
                    <span className="move-text white-move">{moveHistory[i * 2]}</span>
                    <span className="move-text black-move">{moveHistory[i * 2 + 1] || ""}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Game Status */}
            <div className="chess-status-strip">
              {gameOver ? (
                <div className="status-game-over">
                  {isMultiplayer
                    ? gameResult || "Game over"
                    : winner ? `🏆 ${winner} wins!` : "🤝 Game drawn"}
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