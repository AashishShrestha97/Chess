import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Chess, Move } from "chess.js";
import { Chessboard } from "react-chessboard";
import Navbar from "../components/Navbar/Navbar";
import "./VoiceGamePage.css";
import gameService from "../api/games";
import { GameRecorder } from "../utils/gameRecorder";
import { stockfishService } from "../utils/stockfishService";
import { getAccessToken } from "../utils/getAccessToken";

// ---------- Types ----------
interface VoiceGamePageProps {
  timeControl?: string;
}

interface MultiplayerState {
  gameId: number;
  gameUuid: string;
  color: "white" | "black";
  timeControl: string;
  opponentName: string;
  whitePlayer: string;
  blackPlayer: string;
  whitePlayerId: number;
  blackPlayerId: number;
}

interface GameHistoryItem {
  id: number;
  move: string;
  timestamp: number;
  player: "white" | "black";
}

// ---------- Voice recognition types ----------
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any;
  }
}

function parseVoiceMove(transcript: string, game: Chess): { from: string; to: string; promotion?: string } | null {
  // Normalise
  const t = transcript
    .toLowerCase()
    .replace(/alpha/g, "a").replace(/bravo/g, "b").replace(/charlie/g, "c")
    .replace(/delta/g, "d").replace(/echo/g, "e").replace(/foxtrot/g, "f")
    .replace(/golf/g, "g").replace(/hotel/g, "h")
    .replace(/\bto\b/g, " ").replace(/\bmoves\b/g, "").replace(/\b(move|takes|takes|captures|capture)\b/g, " ")
    .replace(/\s+/g, " ").trim();

  // Try SAN directly (e.g. "e4", "Nf3", "O-O")
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const move = game.move(t.replace(/\s/g, ""), { sloppy: true } as any);
    if (move) {
      game.undo();
      return { from: move.from, to: move.to, promotion: move.promotion };
    }
  } catch { /* not valid SAN */ }

  // Try "e2 e4" / "e two e four" patterns
  const rankWords: Record<string, string> = {
    one: "1", two: "2", three: "3", four: "4",
    five: "5", six: "6", seven: "7", eight: "8",
  };
  let normalised = t;
  for (const [word, num] of Object.entries(rankWords)) {
    normalised = normalised.replace(new RegExp(`\\b${word}\\b`, "g"), num);
  }

  const squarePattern = "[a-h][1-8]";
  const match = normalised.match(new RegExp(`(${squarePattern})\\s*(${squarePattern})`, "i"));
  if (match) {
    return { from: match[1], to: match[2] };
  }

  return null;
}

// ---------- Component ----------
const VoiceGamePage: React.FC<VoiceGamePageProps> = ({
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

  // FIX: Use a ref for myColor so it's always fresh inside callbacks
  const myColorRef = useRef<"white" | "black">(mpState?.color ?? "white");
  const myColor = myColorRef.current;

  const [effectiveTimeControl, setEffectiveTimeControl] =
    useState<string>(timeControl);

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());

  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [, setGameHistory] = useState<GameHistoryItem[]>([]);
  const [statusMessage, setStatusMessage] = useState(
    isMultiplayer ? "Connecting..." : "White to move"
  );
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  // FIX: Initialize clocks to 0 for multiplayer — they get set on GAME_START
  const [whiteTime, setWhiteTime] = useState(isMultiplayer ? 0 : 600);
  const [blackTime, setBlackTime] = useState(isMultiplayer ? 0 : 600);
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

  // FIX: clockStarted gate — clock only ticks after GAME_START is received
  const [clockStarted, setClockStarted] = useState(false);
  const clockStartedRef = useRef(false);
  // FIX: gameStarted gate — prevents premature GAME_OVER processing
  const gameStartedRef = useRef(false);

  const gameOverRef = useRef(false);
  const isSoundOnRef = useRef(true);
  const incrementRef = useRef(0);
  const currentTurnRef = useRef<"w" | "b">("w");

  // Time warning flags
  const whiteTimeWarned30 = useRef(false);
  const whiteTimeWarned10 = useRef(false);
  const blackTimeWarned30 = useRef(false);
  const blackTimeWarned10 = useRef(false);

  // Game recorder for saving game data (solo only)
  const gameRecorderRef = useRef<GameRecorder | null>(null);
  const [isSavingGame, setIsSavingGame] = useState(false);

  const [, setCapturedPieces] = useState<{
    white: string[];
    black: string[];
  }>({ white: [], black: [] });

  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(myColor);

  // ── Voice recognition state ────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "listening" | "processing" | "error">("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const voiceSupportedRef = useRef<boolean>(false);

  // ------- Basic sync effects -------
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);
  useEffect(() => { isSoundOnRef.current = isSoundOn; }, [isSoundOn]);
  useEffect(() => { currentTurnRef.current = currentTurn; }, [currentTurn]);
  useEffect(() => { incrementRef.current = increment; }, [increment]);

  // Responsive board width
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

  // Check voice support
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    voiceSupportedRef.current = !!SR;
    if (!SR) setVoiceError("Speech recognition not supported in this browser.");
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

  // FIX: Solo only — init clocks from time control. Multiplayer clocks are set in GAME_START.
  useEffect(() => {
    if (isMultiplayer) return;
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
    setClockStarted(false);
    whiteTimeWarned30.current = false;
    whiteTimeWarned10.current = false;
    blackTimeWarned30.current = false;
    blackTimeWarned10.current = false;
  }, [effectiveTimeControl, isMultiplayer]);

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

      const wsUrl = `ws://localhost:8080/api/game/${mpState.gameId}?token=${token}`;
      console.log("🔌 Connecting to game WS:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setMpConnectionStatus("connecting");

      ws.onopen = () => {
        if (cancelled) return;
        console.log("🎮 Game WS connected");
        setMpConnectionStatus("waiting");
        setStatusMessage("Waiting for opponent...");
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(event.data);
          console.log("📨 Server message:", data.type, data);
          handleServerMessage(data);
        } catch (e) {
          console.error("Failed to parse WS message:", e);
        }
      };

      ws.onerror = (err) => {
        console.error("❌ Game WS error:", err);
        if (!cancelled) setMpConnectionStatus("disconnected");
      };

      ws.onclose = () => {
        console.log("🔌 Game WS closed");
        if (!cancelled && !gameOverRef.current) {
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
  }, [isMultiplayer, mpState?.gameId]); // eslint-disable-line

  // FIX: Auto-resign when player leaves (clicks back, closes tab, or goes offline)
  useEffect(() => {
    if (!isMultiplayer || !gameStartedRef.current) return;

    const handleBeforeUnload = () => {
      // Send resignation message to opponent
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        sendMessage({ type: "RESIGN" });
      }
    };

    const handlePopState = () => {
      // Handle back button
      console.log("🔙 Back button pressed - auto resigning");
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        sendMessage({ type: "RESIGN" });
      }
      gameOverRef.current = true;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isMultiplayer]);

  // FIX: Timeout to detect if GAME_START isn't received (backend issue)
  // FIX: Timeout to detect if GAME_START isn't received (backend issue)
  useEffect(() => {
    if (!isMultiplayer || gameStartedRef.current) return;
    
    const timeoutId = setTimeout(() => {
      if (!gameStartedRef.current && mpConnectionStatus === "waiting") {
        console.warn("⚠️ GAME_START not received after 30 seconds - possible backend issue");
        setStatusMessage("⚠️ Game start delayed - checking server...");
      }
    }, 30000); // 30 second timeout

    return () => clearTimeout(timeoutId);
  }, [isMultiplayer, mpConnectionStatus]);

  // ── Handle incoming WebSocket messages ────────────────────────────────────
  const handleServerMessage = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data: any) => {
      switch (data.type) {

        case "WAITING_FOR_OPPONENT": {
          console.log("⏳ Waiting for opponent...");
          setMpConnectionStatus("waiting");
          setStatusMessage("Waiting for opponent to connect...");
          break;
        }

        case "GAME_START": {
          console.log("🚀 GAME_START received:", data);

          // FIX: Parse time control from GAME_START message (backend should provide this)
          // Fallback to mpState.timeControl if not provided
          let tc: string = (data.timeControl as string) || mpState?.timeControl || "10+0";
          console.log("🕒 Time control from server:", tc);
          
          // Handle encoded time control (may come as "10%2B0" from URL)
          tc = tc.replace("%2B", "+").replace("%2b", "+");
          
          const [mainPart, incStr] = tc.split("+");
          let minutes = Number(mainPart) || 10;
          let inc = Number(incStr) || 0;
          
          // Validation: ensure positive values
          if (minutes <= 0) minutes = 10;
          if (inc < 0) inc = 0;
          
          const totalSecs = Math.max(60, minutes * 60);
          console.log("🕐 Parsed time - Minutes:", minutes, "Increment:", inc, "Total Seconds:", totalSecs);

          // Reset board to starting position
          gameRef.current = new Chess();
          setFen(gameRef.current.fen());
          setMoveHistory([]);
          setGameHistory([]);
          setLastMove(null);
          setCapturedPieces({ white: [], black: [] });
          setGameOver(false);
          setGameResult(null);
          gameOverRef.current = false;

          // FIX: Set clocks from the server's time control
          setWhiteTime(totalSecs);
          setBlackTime(totalSecs);
          setIncrement(inc);
          incrementRef.current = inc;

          // FIX: Reset time warnings
          whiteTimeWarned30.current = false;
          whiteTimeWarned10.current = false;
          blackTimeWarned30.current = false;
          blackTimeWarned10.current = false;

          // FIX: Set myColor correctly from server data
          const myColorFromServer = (data.myColor as "white" | "black") || mpState?.color || "white";
          myColorRef.current = myColorFromServer;
          console.log("🎨 My color:", myColorFromServer);

          // FIX: Start the clock
          clockStartedRef.current = true;
          setClockStarted(true);
          gameStartedRef.current = true;

          setCurrentTurn("w");
          currentTurnRef.current = "w";
          setMpConnectionStatus("playing");

          const myTurn = myColorRef.current === "white";
          setStatusMessage(myTurn ? "Your turn — speak your move!" : "Opponent's turn");
          break;
        }

        case "MOVE": {
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

              const movedColor = data.player as "white" | "black";
              if (incrementRef.current > 0) {
                if (movedColor === "white")
                  setWhiteTime((p) => p + incrementRef.current);
                else setBlackTime((p) => p + incrementRef.current);
              }

              if (game.isCheckmate()) {
                const iWin = movedColor === myColorRef.current;
                setGameOver(true);
                gameOverRef.current = true;
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
                const isMyTurn = nextTurn === myColorRef.current;
                setStatusMessage(isMyTurn ? "Your turn — speak your move!" : "Opponent's turn");
              }
            }
          } catch (e) {
            console.error("❌ Error applying opponent move:", e);
          }
          break;
        }

        case "GAME_OVER": {
          // FIX: Ignore GAME_OVER if the game hasn't started yet (premature disconnect)
          if (!gameStartedRef.current) {
            console.warn("⚠️ Ignoring GAME_OVER — game hasn't started yet. Game data:", data);
            break;
          }

          if (gameOverRef.current) {
            console.warn("⚠️ GAME_OVER already processed, ignoring duplicate");
            break;
          }

          setGameOver(true);
          gameOverRef.current = true;

          const winner = data.winner as string;
          const reason = (data.reason as string) || "Game over";
          console.log("🏁 Game over - Winner:", winner, "Reason:", reason);

          if (winner === "draw" || data.result === "DRAW") {
            setGameResult(`Draw — ${reason.toLowerCase()}`);
            setWinner(null);
          } else {
            const iWin =
              (winner === "white" && myColorRef.current === "white") ||
              (winner === "black" && myColorRef.current === "black");
            setGameResult(iWin ? "You win!" : "You lose!");
            setWinner(iWin ? "You" : "Opponent");
          }
          setStatusMessage(reason);
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
                  ? "Your turn — speak your move!" : "Opponent's turn"
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
    [mpState?.timeControl] // eslint-disable-line
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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

  // ---------- Flag / timeout ----------
  function handleFlag(flagged: "white" | "black") {
    if (gameOverRef.current) return;
    const winColor = flagged === "white" ? "Black" : "White";
    setGameOver(true);
    gameOverRef.current = true;
    setWinner(winColor);
    setStatusMessage(`Time's up! ${winColor} wins on time!`);
    playSound("gameEnd");
    if (isMultiplayer) sendMessage({ type: "FLAG", player: flagged });
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
    source: "board" | "ai" | "voice"
  ): boolean {
    if (gameOverRef.current) return false;

    const game = gameRef.current;
    let move: Move | null = null;
    try {
      move = typeof moveInput === "string"
        ? game.move(moveInput)
        : game.move(moveInput);
    } catch { move = null; }

    if (!move) {
      setStatusMessage("Illegal move — try again");
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

    if (!isMultiplayer && gameRecorderRef.current) {
      gameRecorderRef.current.recordMove(moveInput);
      if (move.color === "w") gameRecorderRef.current.updateTime("black", blackTime);
      else gameRecorderRef.current.updateTime("white", whiteTime);
    }

    if (!clockStartedRef.current) {
      clockStartedRef.current = true;
      setClockStarted(true);
    }

    const sideToMove = game.turn();

    // Apply increment
    if (increment > 0) {
      if (sideToMove === "b") setWhiteTime((prev) => prev + increment);
      else setBlackTime((prev) => prev + increment);
    }

    // Multiplayer: send move over WebSocket
    if (isMultiplayer && (source === "board" || source === "voice")) {
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
            ? "Check! Your turn — speak your move!"
            : "Check! Opponent's turn"
          : "Check!"
      );
      playSound("check");
    } else {
      if (isMultiplayer) {
        setStatusMessage(
          sideToMove === (myColorRef.current === "white" ? "w" : "b")
            ? "Opponent's turn"
            : "Your turn — speak your move!"
        );
      } else {
        setStatusMessage(sideToMove === "w" ? "White to move" : "Black to move");
      }
    }

    setCurrentTurn(game.turn());
    currentTurnRef.current = game.turn();

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
        effectiveTimeControl, "VOICE", terminationReason
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
    if (isMultiplayer) return;
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
    setGameResult(null);
    gameOverRef.current = false;
    clockStartedRef.current = false;
    setClockStarted(false);
    setLastMove(null);
    setCapturedPieces({ white: [], black: [] });
    setVoiceTranscript("");
    setVoiceStatus("idle");
    const [mainPart] = effectiveTimeControl.split("+");
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
    if (isMultiplayer) {
      if (!gameStartedRef.current) return false;
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
    if (isMultiplayer && gameStartedRef.current && !gameOverRef.current) {
      // Auto-resign in multiplayer if game is still active
      console.log("🔙 Going back - auto resigning");
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        sendMessage({ type: "RESIGN" });
      }
      gameOverRef.current = true;
    }
    if (window.history.length > 1) navigate(-1);
    else navigate("/home");
  };

  // ── Voice recognition ──────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!voiceSupportedRef.current) {
      setVoiceError("Speech recognition not supported.");
      return;
    }
    if (gameOverRef.current) return;
    if (isMultiplayer && !gameStartedRef.current) return;

    // Check whose turn
    const myTurn = isMultiplayer
      ? gameRef.current.turn() === (myColorRef.current === "white" ? "w" : "b")
      : gameRef.current.turn() === "w";
    if (!myTurn) {
      setVoiceError("It's not your turn.");
      setTimeout(() => setVoiceError(null), 2000);
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognitionRef.current = recognition;

    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceStatus("listening");
      setVoiceTranscript("");
      setVoiceError(null);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      setVoiceStatus("processing");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = Array.from(event.results[0]) as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transcripts = results.map((r: any) => r.transcript as string);
      setVoiceTranscript(transcripts[0]);

      let moved = false;
      for (const t of transcripts) {
        const parsed = parseVoiceMove(t, gameRef.current);
        if (parsed) {
          moved = applyMove(parsed, "voice");
          if (moved) break;
        }
      }

      if (!moved) {
        setVoiceError(`Couldn't understand "${transcripts[0]}". Try again.`);
        setTimeout(() => setVoiceError(null), 3000);
      }
      setVoiceStatus("idle");
      setIsListening(false);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.error("Voice recognition error:", event.error);
      setVoiceError(`Mic error: ${event.error}`);
      setVoiceStatus("error");
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (voiceStatus === "listening") setVoiceStatus("idle");
    };

    recognition.start();
  }, [isMultiplayer]); // eslint-disable-line

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setVoiceStatus("idle");
  }, []);

  // Clock ticker — only runs when clockStarted is true
  useEffect(() => {
    if (gameOver || isPaused || !clockStarted) return;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTurn, gameOver, isPaused, clockStarted]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  // ── FIX: Derived display values ────────────────────────────────────────────
  // Use the pre-calculated opponent name from MatchmakingPage
  const opponentDisplayName = isMultiplayer
    ? mpState?.opponentName || "Opponent"
    : "ChessMaster AI";
  const opponentColor = myColor === "white" ? "black" : "white";

  const opponentClock = myColor === "white" ? blackTime : whiteTime;
  const myClock       = myColor === "white" ? whiteTime : blackTime;

  const isMyTurn = isMultiplayer
    ? gameStartedRef.current && gameRef.current.turn() === (myColor === "white" ? "w" : "b")
    : gameRef.current.turn() === "w";

  const isDraggable = isMultiplayer
    ? !gameOver && gameStartedRef.current &&
      gameRef.current.turn() === (myColor === "white" ? "w" : "b") && !isPaused
    : !gameOver && gameRef.current.turn() === "w" && !isPaused;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Navbar rating={1847} streak={5} />

      <div className="voice-chess-page">
        <div className="chess-back-row">
          <button className="chess-back-btn" onClick={handleBack}>
            ← Back to Menu
          </button>
          {isMultiplayer && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                className="chess-top-badge"
                style={{
                  background:
                    mpConnectionStatus === "playing"
                      ? "rgba(0,200,100,0.2)"
                      : mpConnectionStatus === "waiting"
                      ? "rgba(255,200,0,0.2)"
                      : "rgba(255,80,80,0.2)",
                  color:
                    mpConnectionStatus === "playing"
                      ? "#00c864"
                      : mpConnectionStatus === "waiting"
                      ? "#ffc800"
                      : "#ff5050",
                  border: `1px solid currentColor`,
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                }}
              >
                {mpConnectionStatus === "playing"
                  ? "● Live"
                  : mpConnectionStatus === "waiting"
                  ? "⏳ Waiting for opponent"
                  : mpConnectionStatus === "connecting"
                  ? "⟳ Connecting"
                  : "✕ Disconnected"}
              </span>
              <span style={{ color: "#888", fontSize: "0.85rem" }}>
                ⏱ {mpState?.timeControl || effectiveTimeControl}
              </span>
            </div>
          )}
        </div>

        <div className="chess-top-bar">
          <div className="chess-top-left">
            <div className="chess-top-title-row">
              <span className="chess-dot" />
              <span className="chess-top-title">
                {isMultiplayer ? "Multiplayer Voice Chess" : "Voice Chess Game"}
              </span>
              <span className="chess-top-badge">
                {isMultiplayer ? "VS Player" : "VS AI"}
              </span>
              <span className="chess-top-badge" style={{ background: "rgba(100,100,255,0.2)", color: "#aaf" }}>
                🎤 Voice Mode
              </span>
            </div>
            <div className="chess-top-subtitle">
              {isMultiplayer ? (
                <>
                  You are playing as{" "}
                  <strong style={{ color: myColor === "white" ? "#fff" : "#aaa" }}>
                    {myColor}
                  </strong>{" "}
                  — {statusMessage}
                </>
              ) : (
                <>
                  Time Control:{" "}
                  <span className="chess-top-subtitle-strong">{effectiveTimeControl}</span>{" "}
                  | Speak moves like "e2 e4" or drag pieces
                </>
              )}
            </div>
          </div>
          <div className="chess-top-right">
            {!isMultiplayer && (
              <>
                <button
                  className="chess-top-button"
                  onClick={() => setIsPaused((p) => !p)}
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
              </>
            )}
          </div>
        </div>

        <div className="chess-main-layout">
          {/* LEFT COLUMN - BOARD */}
          <div className="chess-left-column">

            {/* Opponent player card */}
            {isMultiplayer && (
              <div
                className={`chess-player-card ${opponentClock <= 30 && clockStarted ? "low-time" : ""}`}
                style={{ marginBottom: "8px" }}
              >
                <div className="player-left">
                  <div className="player-avatar ai">
                    {opponentDisplayName[0]?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <div className="player-name">{opponentDisplayName}</div>
                    <div className="player-rating">
                      {opponentColor === "black" ? "⬛ Black" : "⬜ White"}
                    </div>
                  </div>
                </div>
                <div
                  className={`player-clock ${opponentClock <= 30 && clockStarted ? "low-time" : ""} ${opponentClock <= 10 && clockStarted ? "critical-time" : ""}`}
                  style={{ color: !clockStarted ? "#666" : undefined }}
                >
                  {formatTime(opponentClock)}
                </div>
              </div>
            )}

            <div className="chess-board-card">
              <Chessboard
                position={fen}
                onPieceDrop={onDrop}
                boardOrientation={isMultiplayer ? myColor : boardOrientation}
                boardWidth={boardWidth}
                arePiecesDraggable={isDraggable}
                customSquareStyles={getSquareStyles()}
                customBoardStyle={{
                  borderRadius: "16px",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.9)",
                }}
              />

              <div className="chess-board-footer">
                {!isMultiplayer && (
                  <button
                    className="chess-small-btn"
                    onClick={() =>
                      setBoardOrientation((p) => p === "white" ? "black" : "white")
                    }
                  >
                    🔄 Flip Board
                  </button>
                )}
                <button
                  className="chess-small-btn"
                  onClick={() => setShowLegalMoves((p) => !p)}
                >
                  {showLegalMoves ? "👁 Hide Hints" : "👁 Show Hints"}
                </button>
                <button
                  className="chess-small-btn"
                  onClick={() => setIsSoundOn((p) => !p)}
                >
                  {isSoundOn ? "🔊 Sound On" : "🔇 Sound Off"}
                </button>
              </div>
            </div>

            {/* My player card */}
            {isMultiplayer && (
              <div
                className={`chess-player-card you-card ${myClock <= 30 && clockStarted ? "low-time" : ""}`}
                style={{ marginTop: "8px" }}
              >
                <div className="player-left">
                  <div className="player-avatar you">Y</div>
                  <div>
                    <div className="player-name">You</div>
                    <div className="player-rating">
                      {myColor === "white" ? "⬜ White" : "⬛ Black"}
                    </div>
                  </div>
                </div>
                <div
                  className={`player-clock ${myClock <= 30 && clockStarted ? "low-time" : ""} ${myClock <= 10 && clockStarted ? "critical-time" : ""}`}
                  style={{ color: !clockStarted ? "#666" : undefined }}
                >
                  {formatTime(myClock)}
                </div>
              </div>
            )}

            {/* Game Controls */}
            <div className="chess-controls-panel">
              {!isMultiplayer && (
                <button
                  className="chess-control-btn"
                  onClick={handleUndo}
                  disabled={gameOver || moveHistory.length < 2}
                >
                  ↩️ Undo Move
                </button>
              )}
              <button
                className="chess-control-btn"
                onClick={handleOfferDraw}
                disabled={gameOver || (isMultiplayer && !gameStartedRef.current)}
              >
                🤝 Offer Draw
              </button>
              <button
                className="chess-control-btn danger"
                onClick={handleResign}
                disabled={gameOver || (isMultiplayer && !gameStartedRef.current)}
              >
                🏳️ Resign
              </button>
            </div>

            {/* Draw offer banner */}
            {drawOfferReceived && (
              <div className="draw-offer-banner">
                <span>🤝 Opponent offers a draw</span>
                <button className="accept-draw-btn" onClick={handleAcceptDraw}>Accept</button>
                <button className="decline-draw-btn" onClick={handleDeclineDraw}>Decline</button>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div className="chess-right-column">

            {/* VOICE CONTROL PANEL */}
            <div className="voice-panel">
              <div className="voice-panel-header">
                <span className="voice-panel-title">🎤 Voice Controls</span>
                {!voiceSupportedRef.current && (
                  <span className="voice-not-supported">Not supported</span>
                )}
              </div>

              <button
                className={`voice-main-btn ${isListening ? "listening" : ""} ${!voiceSupportedRef.current || gameOver ? "disabled" : ""}`}
                onClick={isListening ? stopListening : startListening}
                disabled={!voiceSupportedRef.current || gameOver || (isMultiplayer && !isMyTurn)}
              >
                {isListening ? (
                  <>
                    <span className="voice-pulse" /> Stop Listening
                  </>
                ) : voiceStatus === "processing" ? (
                  "⏳ Processing..."
                ) : (
                  <>
                    🎤 {isMyTurn ? "Speak Move" : "Not Your Turn"}
                  </>
                )}
              </button>

              {voiceTranscript && (
                <div className="voice-transcript">
                  <span className="voice-transcript-label">Heard:</span>
                  <span className="voice-transcript-text">"{voiceTranscript}"</span>
                </div>
              )}

              {voiceError && (
                <div className="voice-error">{voiceError}</div>
              )}

              <div className="voice-help">
                <div className="voice-help-title">How to speak moves:</div>
                <div className="voice-help-item">• "e2 e4" or "e two e four"</div>
                <div className="voice-help-item">• "Nf3" (standard chess notation)</div>
                <div className="voice-help-item">• "g1 f3" (square to square)</div>
              </div>
            </div>

            {/* Clocks panel for solo mode */}
            {!isMultiplayer && (
              <div className="chess-clocks-panel">
                <div
                  className={`clock-item ${currentTurn === "b" && clockStarted ? "active-clock" : ""} ${blackTime <= 30 && clockStarted ? "low-time" : ""}`}
                >
                  <span className="clock-label">⬛ Black</span>
                  <span className="clock-value">{formatTime(blackTime)}</span>
                </div>
                <div className="clock-divider" />
                <div
                  className={`clock-item ${currentTurn === "w" && clockStarted ? "active-clock" : ""} ${whiteTime <= 30 && clockStarted ? "low-time" : ""}`}
                >
                  <span className="clock-label">⬜ White</span>
                  <span className="clock-value">{formatTime(whiteTime)}</span>
                </div>
              </div>
            )}

            {/* Game Over result panel */}
            {gameOver && (
              <div className="chess-result-card">
                <div className="result-emoji">
                  {(isMultiplayer ? gameResult : winner ? "🏆" : "🤝") || "🏁"}
                </div>
                <div className="result-title">
                  {isMultiplayer
                    ? gameResult || "Game Over"
                    : winner
                    ? `🏆 ${winner} wins!`
                    : "🤝 Game drawn"}
                </div>
                <button
                  className="result-home-btn"
                  onClick={() => navigate("/home")}
                >
                  Back to Home
                </button>
              </div>
            )}

            {/* Move History */}
            <div className="chess-history-panel">
              <div className="chess-history-header">
                <span>♟ Move History</span>
                <span className="chess-history-count">
                  {Math.ceil(moveHistory.length / 2)} moves
                </span>
              </div>
              <div className="move-history-list">
                {moveHistory.length === 0 && (
                  <div className="chess-history-empty">
                    Game moves will be recorded here.
                  </div>
                )}
                {Array.from(
                  { length: Math.ceil(moveHistory.length / 2) },
                  (_, i) => (
                    <div key={i} className="move-history-item">
                      <span className="move-index">{i + 1}.</span>
                      <span className="move-text white-move">{moveHistory[i * 2]}</span>
                      <span className="move-text black-move">{moveHistory[i * 2 + 1] || ""}</span>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Game Status */}
            <div className="chess-status-strip">
              {gameOver ? (
                <div className="status-game-over">
                  {isMultiplayer
                    ? gameResult || "Game over"
                    : winner
                    ? `🏆 ${winner} wins!`
                    : "🤝 Game drawn"}
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

export default VoiceGamePage;