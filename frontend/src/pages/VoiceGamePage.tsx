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
  const t = transcript
    .toLowerCase()
    .replace(/alpha/g, "a").replace(/bravo/g, "b").replace(/charlie/g, "c")
    .replace(/delta/g, "d").replace(/echo/g, "e").replace(/foxtrot/g, "f")
    .replace(/golf/g, "g").replace(/hotel/g, "h")
    .replace(/\bto\b/g, " ").replace(/\bmoves\b/g, "").replace(/\b(move|takes|takes|captures|capture)\b/g, " ")
    .replace(/\s+/g, " ").trim();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const move = game.move(t.replace(/\s/g, ""), { sloppy: true } as any);
    if (move) {
      game.undo();
      return { from: move.from, to: move.to, promotion: move.promotion };
    }
  } catch { /* not valid SAN */ }

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

  const myColorRef = useRef<"white" | "black">(mpState?.color ?? "white");
  const myColor = myColorRef.current;

  const [effectiveTimeControl, setEffectiveTimeControl] = useState<string>(timeControl);

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());

  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [, setGameHistory] = useState<GameHistoryItem[]>([]);
  const [statusMessage, setStatusMessage] = useState(
    isMultiplayer ? "Connecting..." : "White to move"
  );
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

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

  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [mpConnectionStatus, setMpConnectionStatus] = useState<
    "connecting" | "waiting" | "playing" | "disconnected"
  >("connecting");

  const [clockStarted, setClockStarted] = useState(false);
  const clockStartedRef = useRef(false);
  const gameStartedRef = useRef(false);

  const gameOverRef = useRef(false);
  const isSoundOnRef = useRef(true);
  const incrementRef = useRef(0);
  const currentTurnRef = useRef<"w" | "b">("w");

  const whiteTimeRef = useRef(isMultiplayer ? 0 : 600);
  const blackTimeRef = useRef(isMultiplayer ? 0 : 600);

  const whiteTimeWarned30 = useRef(false);
  const whiteTimeWarned10 = useRef(false);
  const blackTimeWarned30 = useRef(false);
  const blackTimeWarned10 = useRef(false);

  const gameRecorderRef = useRef<GameRecorder | null>(null);
  const [isSavingGame, setIsSavingGame] = useState(false);

  const [, setCapturedPieces] = useState<{ white: string[]; black: string[] }>({ white: [], black: [] });
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(myColor);

  // ── Voice recognition state ────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "listening" | "processing" | "error">("idle");
  const voiceStatusRef = useRef<"idle" | "listening" | "processing" | "error">("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const voiceSupportedRef = useRef<boolean>(false);

  // ------- Basic sync effects -------
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);
  useEffect(() => { isSoundOnRef.current = isSoundOn; }, [isSoundOn]);
  useEffect(() => { currentTurnRef.current = currentTurn; }, [currentTurn]);
  useEffect(() => { incrementRef.current = increment; }, [increment]);
  useEffect(() => { whiteTimeRef.current = whiteTime; }, [whiteTime]);
  useEffect(() => { blackTimeRef.current = blackTime; }, [blackTime]);
  useEffect(() => { voiceStatusRef.current = voiceStatus; }, [voiceStatus]);

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

  // Solo only — init clocks
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
    whiteTimeRef.current = totalSeconds;
    blackTimeRef.current = totalSeconds;
    setIncrement(inc);
    incrementRef.current = inc;
    clockStartedRef.current = false;
    setClockStarted(false);
    whiteTimeWarned30.current = false;
    whiteTimeWarned10.current = false;
    blackTimeWarned30.current = false;
    blackTimeWarned10.current = false;
  }, [effectiveTimeControl, isMultiplayer]);

  useEffect(() => {
    if (isMultiplayer) return; // Don't re-init recorder during active multiplayer game
    gameRecorderRef.current = new GameRecorder(effectiveTimeControl);
  }, [effectiveTimeControl, isMultiplayer]);

  useEffect(() => {
    if (isMultiplayer) return;
    const initStockfish = async () => {
      try { await stockfishService.initialize(); }
      catch (error) { console.error("❌ Failed to initialize Stockfish:", error); }
    };
    initStockfish();
    return () => { stockfishService.terminate(); };
  }, [isMultiplayer]);

  // ── WebSocket send helper ──
  const sendMessage = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // ---------- Sound Effects ----------
  const playSound = useCallback((soundType: "move" | "capture" | "check" | "gameEnd") => {
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
  }, []);

  // ---------- Flag / timeout ----------
  const handleFlag = useCallback((flagged: "white" | "black") => {
    if (gameOverRef.current) return;
    const winColor = flagged === "white" ? "Black" : "White";
    setGameOver(true);
    gameOverRef.current = true;
    setWinner(winColor);
    setStatusMessage(`Time's up! ${winColor} wins on time!`);
    playSound("gameEnd");
    if (isMultiplayer) sendMessage({ type: "FLAG", player: flagged });
  }, [isMultiplayer, playSound, sendMessage]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  /**
   * Apply move — handles both solo (AI game) and multiplayer
   */
  const applyMove = useCallback((
    moveInput: string | { from: string; to: string; promotion?: string },
    source: "board" | "ai" | "voice"
  ): boolean => {
    if (gameOverRef.current) return false;

    const game = gameRef.current;
    let move: Move | null = null;
    try {
      move = typeof moveInput === "string" ? game.move(moveInput) : game.move(moveInput);
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

    if (gameRecorderRef.current) {
      gameRecorderRef.current.recordMove(moveInput);
      if (move.color === "w") gameRecorderRef.current.updateTime("black", blackTimeRef.current * 1000);
      else gameRecorderRef.current.updateTime("white", whiteTimeRef.current * 1000);
    }

    if (!clockStartedRef.current) {
      clockStartedRef.current = true;
      setClockStarted(true);
    }

    const sideToMove = game.turn();

    if (incrementRef.current > 0) {
      if (sideToMove === "b") setWhiteTime((prev) => prev + incrementRef.current);
      else setBlackTime((prev) => prev + incrementRef.current);
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
        // ✅ Tell backend to save the game with moves_json
        sendMessage({
          type: "GAME_OVER",
          winner: winColor.toLowerCase(),
          reason: "Checkmate",
          movesJson: gameRecorderRef.current?.getMovesAsJSON() ?? null,
        });
      }
      playSound("gameEnd");
    } else if (game.isDraw()) {
      let msg = "Game drawn";
      let drawReason = "Draw";
      if (game.isStalemate()) { msg = "Stalemate! Game drawn"; drawReason = "Stalemate"; }
      else if (game.isThreefoldRepetition()) { msg = "Draw by threefold repetition"; drawReason = "Threefold repetition"; }
      else if (game.isInsufficientMaterial()) { msg = "Draw by insufficient material"; drawReason = "Insufficient material"; }
      setGameOver(true);
      gameOverRef.current = true;
      setWinner(null);
      setStatusMessage(msg);
      if (isMultiplayer) {
        setGameResult("Draw!");
        // ✅ Tell backend to save the game with moves_json
        sendMessage({
          type: "GAME_OVER",
          winner: "draw",
          reason: drawReason,
          movesJson: gameRecorderRef.current?.getMovesAsJSON() ?? null,
        });
      }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiplayer, playSound, sendMessage]);

  // ── Handle incoming WebSocket messages ────────────────────────────────────
  const handleServerMessage = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data: any) => {
      switch (data.type) {

        case "WAITING_FOR_OPPONENT": {
          setMpConnectionStatus("waiting");
          setStatusMessage("Waiting for opponent to connect...");
          break;
        }

        case "GAME_START": {
          console.log("🚀 GAME_START received:", data);

          let tc: string = (data.timeControl as string) || mpState?.timeControl || "10+0";
          tc = tc.replace("%2B", "+").replace("%2b", "+");
          setEffectiveTimeControl(tc);
          
          // ✅ Initialize fresh GameRecorder for multiplayer
          gameRecorderRef.current = new GameRecorder(tc);

          const [mainPart, incStr] = tc.split("+");
          let minutes = Number(mainPart) || 10;
          let inc = Number(incStr) || 0;
          if (minutes <= 0) minutes = 10;
          if (inc < 0) inc = 0;
          const totalSecs = Math.max(60, minutes * 60);

          gameRef.current = new Chess();
          setFen(gameRef.current.fen());
          setMoveHistory([]);
          setGameHistory([]);
          setLastMove(null);
          setCapturedPieces({ white: [], black: [] });
          setGameOver(false);
          setGameResult(null);
          gameOverRef.current = false;

          setWhiteTime(totalSecs);
          setBlackTime(totalSecs);
          whiteTimeRef.current = totalSecs;
          blackTimeRef.current = totalSecs;
          setIncrement(inc);
          incrementRef.current = inc;

          whiteTimeWarned30.current = false;
          whiteTimeWarned10.current = false;
          blackTimeWarned30.current = false;
          blackTimeWarned10.current = false;

          const myColorFromServer = (data.myColor as "white" | "black") || mpState?.color || "white";
          myColorRef.current = myColorFromServer;

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

              if (isMultiplayer && gameRecorderRef.current && move) {
                gameRecorderRef.current.recordMove(move.san);
                const movedColor = data.player as "white" | "black";
                if (movedColor === "white") gameRecorderRef.current.updateTime("white", whiteTimeRef.current * 1000);
                else gameRecorderRef.current.updateTime("black", blackTimeRef.current * 1000);
              }

              const nextTurn = data.turn as "white" | "black";
              const nextTurnChar = nextTurn === "white" ? "w" : "b";
              setCurrentTurn(nextTurnChar);
              currentTurnRef.current = nextTurnChar;

              const movedColor = data.player as "white" | "black";
              if (incrementRef.current > 0) {
                if (movedColor === "white") setWhiteTime((p) => p + incrementRef.current);
                else setBlackTime((p) => p + incrementRef.current);
              }

              if (game.isCheckmate()) {
                const iWin = movedColor === myColorRef.current;
                setGameOver(true);
                gameOverRef.current = true;
                setGameResult(iWin ? "You win! by checkmate" : "You lose! by checkmate");
                setStatusMessage("Checkmate!");
                // ✅ Opponent's move caused checkmate — notify server to save
                sendMessage({
                  type: "GAME_OVER",
                  winner: movedColor,
                  reason: "Checkmate",
                });
              } else if (game.isDraw()) {
                setGameOver(true);
                gameOverRef.current = true;
                setGameResult("Draw!");
                setStatusMessage("Game drawn");
                // ✅ Notify server to save draw
                sendMessage({
                  type: "GAME_OVER",
                  winner: "draw",
                  reason: "Draw",
                });
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
          if (!gameStartedRef.current) {
            console.warn("⚠️ Ignoring GAME_OVER — game hasn't started yet.");
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
            () => setStatusMessage(
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mpState?.timeControl, mpState?.color, sendMessage]
  );

  // ── Multiplayer WebSocket ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isMultiplayer || !mpState?.gameId) return;

    let cancelled = false;

    const connect = async () => {
      const token = await getAccessToken();
      if (!token || cancelled) return;

      const wsUrl = `ws://localhost:8080/api/game/${mpState.gameId}?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setMpConnectionStatus("connecting");

      ws.onopen = () => {
        if (cancelled) return;
        setMpConnectionStatus("waiting");
        setStatusMessage("Waiting for opponent...");
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(event.data);
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
  }, [isMultiplayer, mpState?.gameId, handleServerMessage]);

  // Auto-resign when player leaves
  useEffect(() => {
    if (!isMultiplayer) return;

    const handleBeforeUnload = () => {
      if (gameStartedRef.current && !gameOverRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        sendMessage({ type: "RESIGN" });
      }
    };

    const handlePopState = () => {
      if (gameStartedRef.current && !gameOverRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
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
  }, [isMultiplayer, sendMessage]);

  // Timeout to detect if GAME_START isn't received
  useEffect(() => {
    if (!isMultiplayer) return;
    const timeoutId = setTimeout(() => {
      if (!gameStartedRef.current && mpConnectionStatus === "waiting") {
        setStatusMessage("⚠️ Game start delayed - checking server...");
      }
    }, 30000);
    return () => clearTimeout(timeoutId);
  }, [isMultiplayer, mpConnectionStatus]);

  // Save completed game to database — SOLO ONLY
  // Multiplayer games are saved by the backend WebSocket handler (endGameAndSave)
  const saveGameToDB = useCallback(async (result: "WIN" | "LOSS" | "DRAW", terminationReason: string) => {
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
      const gameStats = recorder.getGameStats();

      // Solo AI game save
      const pgn = recorder.generatePGN(
        "You (White)", "ChessMaster AI", result,
        effectiveTimeControl, "VOICE", terminationReason
      );
      const accuracy = 75 + Math.floor(Math.random() * 20);
      await gameService.saveGame({
        opponentName: "ChessMaster AI",
        result, pgn, movesJson,
        whiteRating: 1847, blackRating: 1923,
        timeControl: effectiveTimeControl,
        gameType: "VOICE" as const,
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
  }, [effectiveTimeControl]);

  // Solo AI move
  const makeAIMove = useCallback(async () => {
    if (gameOverRef.current || isMultiplayer) return;
    const game = gameRef.current;
    try {
      const move = await stockfishService.getBestMove(game.fen(), 3);
      if (move) applyMove(move, "ai");
      else makeRandomMove();
    } catch { makeRandomMove(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiplayer, applyMove]);

  const makeRandomMove = useCallback(() => {
    const game = gameRef.current;
    const legalMoves = game.moves();
    if (legalMoves.length === 0) return;
    applyMove(legalMoves[Math.floor(Math.random() * legalMoves.length)], "ai");
  }, [applyMove]);

  const handleNewGame = useCallback(() => {
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
    voiceStatusRef.current = "idle";
    const [mainPart] = effectiveTimeControl.split("+");
    let minutesPart = mainPart;
    if (minutesPart.includes("/")) minutesPart = minutesPart.split("/")[0];
    const minutes = Number(minutesPart) || 0;
    const totalSecs = minutes * 60;
    setWhiteTime(totalSecs);
    setBlackTime(totalSecs);
    whiteTimeRef.current = totalSecs;
    blackTimeRef.current = totalSecs;
    whiteTimeWarned30.current = false;
    whiteTimeWarned10.current = false;
    blackTimeWarned30.current = false;
    blackTimeWarned10.current = false;
  }, [isMultiplayer, effectiveTimeControl]);

  const handleUndo = useCallback(() => {
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
  }, [isMultiplayer, moveHistory.length]);

  const handleOfferDraw = useCallback(() => {
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
        setTimeout(() => setStatusMessage(currentTurnRef.current === "w" ? "White to move" : "Black to move"), 2000);
      }
    }
  }, [isMultiplayer, playSound, sendMessage]);

  const handleResign = useCallback(() => {
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
  }, [isMultiplayer, playSound, sendMessage]);

  const handleAcceptDraw = useCallback(() => {
    sendMessage({ type: "ACCEPT_DRAW" });
    setDrawOfferReceived(false);
  }, [sendMessage]);

  const handleDeclineDraw = useCallback(() => {
    sendMessage({ type: "DECLINE_DRAW" });
    setDrawOfferReceived(false);
  }, [sendMessage]);

  const onDrop = useCallback((sourceSquare: string, targetSquare: string) => {
    if (gameOverRef.current) return false;
    if (isMultiplayer) {
      if (!gameStartedRef.current) return false;
      const myTurn = myColorRef.current === "white" ? "w" : "b";
      if (gameRef.current.turn() !== myTurn) return false;
    } else {
      if (gameRef.current.turn() !== "w") return false;
    }
    return applyMove({ from: sourceSquare, to: targetSquare, promotion: "q" }, "board");
  }, [isMultiplayer, applyMove]);

  const getSquareStyles = useCallback(() => {
    if (!showLegalMoves) return {};
    const styles: { [square: string]: React.CSSProperties } = {};
    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: "rgba(255, 255, 0, 0.4)" };
      styles[lastMove.to]   = { backgroundColor: "rgba(255, 255, 0, 0.4)" };
    }
    return styles;
  }, [showLegalMoves, lastMove]);

  const handleBack = useCallback(() => {
    if (isMultiplayer && gameStartedRef.current && !gameOverRef.current) {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        sendMessage({ type: "RESIGN" });
      }
      gameOverRef.current = true;
    }
    if (window.history.length > 1) navigate(-1);
    else navigate("/home");
  }, [isMultiplayer, navigate, sendMessage]);

  // ── Voice recognition ──────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!voiceSupportedRef.current) {
      setVoiceError("Speech recognition not supported.");
      return;
    }
    if (gameOverRef.current) return;
    if (isMultiplayer && !gameStartedRef.current) return;

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
      voiceStatusRef.current = "listening";
      setVoiceTranscript("");
      setVoiceError(null);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      setVoiceStatus("processing");
      voiceStatusRef.current = "processing";
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
      voiceStatusRef.current = "idle";
      setIsListening(false);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.error("Voice recognition error:", event.error);
      setVoiceError(`Mic error: ${event.error}`);
      setVoiceStatus("error");
      voiceStatusRef.current = "error";
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (voiceStatusRef.current === "listening") {
        setVoiceStatus("idle");
        voiceStatusRef.current = "idle";
      }
    };

    recognition.start();
  }, [isMultiplayer, applyMove]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setVoiceStatus("idle");
    voiceStatusRef.current = "idle";
  }, []);

  // Clock ticker
  useEffect(() => {
    if (gameOver || isPaused || !clockStarted) return;
    let timerId: number;
    if (currentTurn === "w") {
      timerId = window.setInterval(() => {
        setWhiteTime((prev) => {
          const next = prev - 1;
          whiteTimeRef.current = next;
          if (prev === 30 && !whiteTimeWarned30.current) whiteTimeWarned30.current = true;
          if (prev === 10 && !whiteTimeWarned10.current) whiteTimeWarned10.current = true;
          if (prev <= 1) { handleFlag("white"); return 0; }
          return next;
        });
      }, 1000);
    } else {
      timerId = window.setInterval(() => {
        setBlackTime((prev) => {
          const next = prev - 1;
          blackTimeRef.current = next;
          if (prev === 30 && !blackTimeWarned30.current) blackTimeWarned30.current = true;
          if (prev === 10 && !blackTimeWarned10.current) blackTimeWarned10.current = true;
          if (prev <= 1) { handleFlag("black"); return 0; }
          return next;
        });
      }, 1000);
    }
    return () => window.clearInterval(timerId);
  }, [currentTurn, gameOver, isPaused, clockStarted, handleFlag]);

  // Multiplayer: send periodic time updates
  useEffect(() => {
    if (!isMultiplayer || !clockStartedRef.current || gameOver) return;
    const timer = window.setInterval(() => {
      sendMessage({ type: "TIME_UPDATE", whiteMs: whiteTimeRef.current * 1000, blackMs: blackTimeRef.current * 1000 });
    }, 5000);
    return () => clearInterval(timer);
  }, [isMultiplayer, gameOver, sendMessage]);

  // ✅ Save game on end — SOLO ONLY
  // Multiplayer is saved server-side via endGameAndSave() triggered by GAME_OVER message
  useEffect(() => {
    if (!gameOver || isSavingGame) return;
    if (isMultiplayer) return;
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
  }, [gameOver, isSavingGame, isMultiplayer, winner, statusMessage, saveGameToDB]);

  // ── Derived display values ────────────────────────────────────────────────
  const opponentDisplayName = isMultiplayer ? mpState?.opponentName || "Opponent" : "ChessMaster AI";
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
                    mpConnectionStatus === "playing" ? "rgba(0,200,100,0.2)"
                    : mpConnectionStatus === "waiting" ? "rgba(255,200,0,0.2)"
                    : "rgba(255,80,80,0.2)",
                  color:
                    mpConnectionStatus === "playing" ? "#00c864"
                    : mpConnectionStatus === "waiting" ? "#ffc800"
                    : "#ff5050",
                  border: `1px solid currentColor`,
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                }}
              >
                {mpConnectionStatus === "playing" ? "● Live"
                  : mpConnectionStatus === "waiting" ? "⏳ Waiting for opponent"
                  : mpConnectionStatus === "connecting" ? "⟳ Connecting"
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
              <span className="chess-top-badge">{isMultiplayer ? "VS Player" : "VS AI"}</span>
              <span className="chess-top-badge" style={{ background: "rgba(100,100,255,0.2)", color: "#aaf" }}>
                🎤 Voice Mode
              </span>
            </div>
            <div className="chess-top-subtitle">
              {isMultiplayer ? (
                <>
                  You are playing as{" "}
                  <strong style={{ color: myColor === "white" ? "#fff" : "#aaa" }}>{myColor}</strong>
                  {" "}— {statusMessage}
                </>
              ) : (
                <>
                  Time Control:{" "}
                  <span className="chess-top-subtitle-strong">{effectiveTimeControl}</span>
                  {" "}| Speak moves like "e2 e4" or drag pieces
                </>
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

            {isMultiplayer && (
              <div
                className={`chess-player-card ${opponentClock <= 30 && clockStarted ? "low-time" : ""}`}
                style={{ marginBottom: "8px" }}
              >
                <div className="player-left">
                  <div className="player-avatar ai">{opponentDisplayName[0]?.toUpperCase() || "?"}</div>
                  <div>
                    <div className="player-name">{opponentDisplayName}</div>
                    <div className="player-rating">{opponentColor === "black" ? "⬛ Black" : "⬜ White"}</div>
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
                  <button className="chess-small-btn" onClick={() => setBoardOrientation((p) => p === "white" ? "black" : "white")}>
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

            {isMultiplayer && (
              <div
                className={`chess-player-card you-card ${myClock <= 30 && clockStarted ? "low-time" : ""}`}
                style={{ marginTop: "8px" }}
              >
                <div className="player-left">
                  <div className="player-avatar you">Y</div>
                  <div>
                    <div className="player-name">You</div>
                    <div className="player-rating">{myColor === "white" ? "⬜ White" : "⬛ Black"}</div>
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

            <div className="chess-controls-panel">
              {!isMultiplayer && (
                <button className="chess-control-btn" onClick={handleUndo} disabled={gameOver || moveHistory.length < 2}>
                  ↩️ Undo Move
                </button>
              )}
              <button className="chess-control-btn" onClick={handleOfferDraw} disabled={gameOver || (isMultiplayer && !gameStartedRef.current)}>
                🤝 Offer Draw
              </button>
              <button className="chess-control-btn danger" onClick={handleResign} disabled={gameOver || (isMultiplayer && !gameStartedRef.current)}>
                🏳️ Resign
              </button>
            </div>

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
                  <><span className="voice-pulse" /> Stop Listening</>
                ) : voiceStatus === "processing" ? (
                  "⏳ Processing..."
                ) : (
                  <>🎤 {isMyTurn ? "Speak Move" : "Not Your Turn"}</>
                )}
              </button>

              {voiceTranscript && (
                <div className="voice-transcript">
                  <span className="voice-transcript-label">Heard:</span>
                  <span className="voice-transcript-text">"{voiceTranscript}"</span>
                </div>
              )}

              {voiceError && <div className="voice-error">{voiceError}</div>}

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
                <div className={`clock-item ${currentTurn === "b" && clockStarted ? "active-clock" : ""} ${blackTime <= 30 && clockStarted ? "low-time" : ""}`}>
                  <span className="clock-label">⬛ Black</span>
                  <span className="clock-value">{formatTime(blackTime)}</span>
                </div>
                <div className="clock-divider" />
                <div className={`clock-item ${currentTurn === "w" && clockStarted ? "active-clock" : ""} ${whiteTime <= 30 && clockStarted ? "low-time" : ""}`}>
                  <span className="clock-label">⬜ White</span>
                  <span className="clock-value">{formatTime(whiteTime)}</span>
                </div>
              </div>
            )}

            {isMultiplayer && !gameStartedRef.current && mpConnectionStatus !== "disconnected" && !gameOver && (
              <div style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.25)", borderRadius: "16px", padding: "24px", marginBottom: "16px", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: "8px" }}>⏳</div>
                <div style={{ color: "#ffd700", fontSize: "1rem", fontWeight: 600, marginBottom: "8px" }}>
                  {mpConnectionStatus === "waiting" ? "Waiting for opponent to connect..." : "Connecting to game server..."}
                </div>
                <div style={{ color: "#888", fontSize: "0.85rem" }}>
                  You are playing as <strong style={{ color: myColor === "white" ? "#fff" : "#ccc" }}>{myColor}</strong>
                </div>
              </div>
            )}

            {gameOver && (
              <div className="chess-result-card">
                <div className="result-emoji">
                  {(isMultiplayer ? gameResult : winner ? "🏆" : "🤝") || "🏁"}
                </div>
                <div className="result-title">
                  {isMultiplayer
                    ? gameResult || "Game Over"
                    : winner ? `🏆 ${winner} wins!` : "🤝 Game drawn"}
                </div>
                <button className="result-home-btn" onClick={() => navigate("/home")}>
                  Back to Home
                </button>
              </div>
            )}

            <div className="chess-history-panel">
              <div className="chess-history-header">
                <span>♟ Move History</span>
                <span className="chess-history-count">{Math.ceil(moveHistory.length / 2)} moves</span>
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

            <div className="chess-status-strip">
              {gameOver ? (
                <div className="status-game-over">
                  {isMultiplayer ? gameResult || "Game over" : winner ? `🏆 ${winner} wins!` : "🤝 Game drawn"}
                </div>
              ) : (
                <div className="status-active">{isPaused ? "⏸ Game Paused" : statusMessage}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default VoiceGamePage;