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
import { parseVoiceMove } from "../hooks/useVoiceChess";
import RatingChangePopup from "../components/RatingChangePopup/RatingChangePopup";
import { getMyRating, getMyRatingHistory } from "../api/ratings";

// ─── Types ────────────────────────────────────────────────────────────────────

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

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// ─── TTS helpers ──────────────────────────────────────────────────────────────

let ttsQueue: string[] = [];
let ttsSpeaking = false;
let ttsOnDoneGlobal: (() => void) | undefined;

function speak(text: string, onDone?: () => void) {
  if (!window.speechSynthesis) { onDone?.(); return; }
  ttsQueue.push(text);
  ttsOnDoneGlobal = onDone;
  if (!ttsSpeaking) drainTTS();
}

function drainTTS() {
  if (ttsQueue.length === 0) {
    ttsSpeaking = false;
    ttsOnDoneGlobal?.();
    ttsOnDoneGlobal = undefined;
    return;
  }
  ttsSpeaking = true;
  const text = ttsQueue.shift()!;
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 1.05;
  utt.pitch = 1;
  const voices = window.speechSynthesis.getVoices();
  const best = voices.find(v => v.lang.startsWith("en-US") && v.name.includes("Google"))
    || voices.find(v => v.lang.startsWith("en"));
  if (best) utt.voice = best;
  utt.onend = drainTTS;
  utt.onerror = drainTTS;
  window.speechSynthesis.speak(utt);
}

function stopSpeaking() {
  ttsQueue = [];
  ttsSpeaking = false;
  window.speechSynthesis?.cancel();
}

// ─── Convert SAN to speakable words ──────────────────────────────────────────

function sanToWords(san: string): string {
  san = san.replace(/[+#!?]/g, "");
  if (san === "O-O-O") return "queen side castle";
  if (san === "O-O") return "king side castle";
  const pieceNames: Record<string, string> = { N: "knight", B: "bishop", R: "rook", Q: "queen", K: "king" };
  const rankWords: Record<string, string> = { "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight" };
  const sq = (s: string) => `${s[0]} ${rankWords[s[1]] || s[1]}`;

  const pm = san.match(/^([NBRQK])([a-h]?[1-8]?)x?([a-h][1-8])(=[NBRQK])?$/);
  if (pm) return `${pieceNames[pm[1]]} to ${sq(pm[3])}${pm[4] ? " promotes to " + pieceNames[pm[4][1]] : ""}`;

  const pc = san.match(/^([a-h])x([a-h][1-8])$/);
  if (pc) return `${pc[1]} takes ${sq(pc[2])}`;

  const pp = san.match(/^([a-h][1-8])$/);
  if (pp) return `pawn to ${sq(pp[1])}`;

  const prom = san.match(/^([a-h][1-8])(=[NBRQK])$/);
  if (prom) return `pawn to ${sq(prom[1])} promotes to ${pieceNames[prom[2][1]]}`;

  const capProm = san.match(/^([a-h])x([a-h][1-8])(=[NBRQK])$/);
  if (capProm) return `${capProm[1]} takes ${sq(capProm[2])} promotes to ${pieceNames[capProm[3][1]]}`;

  return san;
}

function getSuggestions(game: Chess): string {
  const moves = game.moves({ verbose: true });
  if (!moves.length) return "";
  const checks = moves.filter(m => m.san.includes("+"));
  const captures = moves.filter(m => m.san.includes("x"));
  const pool = [...checks.slice(0, 1), ...captures.slice(0, 1), ...moves.slice(0, 3)];
  const unique = [...new Map(pool.map(m => [m.san, m])).values()].slice(0, 3);
  const names = unique.map(m => sanToWords(m.san));
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names[0]}, ${names[1]}, or ${names[2]}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const VoiceGamePage: React.FC<{ timeControl?: string }> = ({ timeControl = "10+0" }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as ({ timeControl?: string } & Partial<MultiplayerState>) | null;

  const isMultiplayer = !!(routeState as MultiplayerState)?.gameId;
  const mpState = isMultiplayer ? (routeState as MultiplayerState) : null;
  const wsRef = useRef<WebSocket | null>(null);

  const myColorRef = useRef<"white" | "black">(mpState?.color ?? "white");
  const myColor = myColorRef.current;

  const [effectiveTimeControl, setEffectiveTimeControl] = useState(timeControl);
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [, setGameHistory] = useState<GameHistoryItem[]>([]);
  const [statusMessage, setStatusMessage] = useState(isMultiplayer ? "Connecting..." : "White to move");
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  const [increment, setIncrement] = useState(0);
  const [currentTurn, setCurrentTurn] = useState<"w" | "b">("w");
  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [showLegalMoves, setShowLegalMoves] = useState(true);
  const [boardWidth, setBoardWidth] = useState(480);
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [mpConnectionStatus, setMpConnectionStatus] = useState<"connecting" | "waiting" | "playing" | "disconnected">("connecting");
  const [clockStarted, setClockStarted] = useState(false);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(myColor);
  const [, setCapturedPieces] = useState<{ white: string[]; black: string[] }>({ white: [], black: [] });
  const [isSavingGame, setIsSavingGame] = useState(false);

  // ── Voice state ───────────────────────────────────────────────────────────
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceStatusText, setVoiceStatusText] = useState("Waiting for your turn...");
  const [voiceIndicator, setVoiceIndicator] = useState<"idle" | "listening" | "processing" | "speaking">("idle");
  const [voiceSupported] = useState(!!SR);

  // ── Rating change popup state ─────────────────────────────────────────────
  const [ratingChange, setRatingChange] = useState<{
    change: number;
    newRating: number;
  } | null>(null);

  const voiceActiveRef = useRef(false);
  const voiceSpeakingRef = useRef(false);
  const recognitionRef = useRef<any>(null);

  const gameOverRef = useRef(false);
  const isSoundOnRef = useRef(true);
  const incrementRef = useRef(0);
  const currentTurnRef = useRef<"w" | "b">("w");
  const whiteTimeRef = useRef(600);
  const blackTimeRef = useRef(600);
  const clockStartedRef = useRef(false);
  const gameStartedRef = useRef(false);
  const whiteTimeWarned30 = useRef(false);
  const whiteTimeWarned10 = useRef(false);
  const blackTimeWarned30 = useRef(false);
  const blackTimeWarned10 = useRef(false);
  const gameRecorderRef = useRef<GameRecorder | null>(null);

  // Sync refs
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);
  useEffect(() => { isSoundOnRef.current = isSoundOn; }, [isSoundOn]);
  useEffect(() => { currentTurnRef.current = currentTurn; }, [currentTurn]);
  useEffect(() => { incrementRef.current = increment; }, [increment]);
  useEffect(() => { whiteTimeRef.current = whiteTime; }, [whiteTime]);
  useEffect(() => { blackTimeRef.current = blackTime; }, [blackTime]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // ── Audio feedback ────────────────────────────────────────────────────────
  const playSound = useCallback((type: "move" | "capture" | "check" | "gameEnd") => {
    if (!isSoundOnRef.current) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      const freqs = { move: 400, capture: 300, check: 600, gameEnd: 500 };
      osc.frequency.value = freqs[type];
      gain.gain.value = 0.1;
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    } catch { /* ignore */ }
  }, []);

  // ── Resize board ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handle = () => {
      const w = window.innerWidth;
      setBoardWidth(w >= 1600 ? 520 : w >= 1400 ? 480 : w >= 1200 ? 440 : w >= 1024 ? 400 : w >= 800 ? 360 : Math.max(280, w - 60));
    };
    handle(); window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  // ── Time control setup ────────────────────────────────────────────────────
  useEffect(() => {
    let tc: string | undefined = routeState?.timeControl as string | undefined;
    if (!tc) { try { const c = JSON.parse(sessionStorage.getItem("gameConfig") || "{}"); if (c.time) tc = String(c.time); } catch { } }
    setEffectiveTimeControl(tc || timeControl || "10+0");
  }, [routeState, timeControl]);

  useEffect(() => {
    if (isMultiplayer) return;
    const [m, i] = effectiveTimeControl.split("+");
    const mins = Number(m.split("/")[0]) || 0;
    const inc = Number(i) || 0;
    const secs = mins * 60;
    setWhiteTime(secs); setBlackTime(secs);
    whiteTimeRef.current = secs; blackTimeRef.current = secs;
    setIncrement(inc); incrementRef.current = inc;
    clockStartedRef.current = false; setClockStarted(false);
    whiteTimeWarned30.current = false; whiteTimeWarned10.current = false;
    blackTimeWarned30.current = false; blackTimeWarned10.current = false;
  }, [effectiveTimeControl, isMultiplayer]);

  useEffect(() => {
    if (isMultiplayer) return;
    gameRecorderRef.current = new GameRecorder(effectiveTimeControl);
  }, [effectiveTimeControl, isMultiplayer]);

  useEffect(() => {
    if (isMultiplayer) return;
    stockfishService.initialize().catch(console.error);
    return () => stockfishService.terminate();
  }, [isMultiplayer]);

  const sendMessage = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(msg));
  }, []);

  // ── Fetch updated rating after game ends ──────────────────────────────────
  useEffect(() => {
    if (!gameOver) return;
    const timer = setTimeout(async () => {
      try {
        const [ratingRes, historyRes] = await Promise.all([
          getMyRating(),
          getMyRatingHistory(),
        ]);
        const profile = ratingRes.data;
        const history = historyRes.data;
        const lastChange = history.length > 0
          ? history[history.length - 1].change
          : 0;
        setRatingChange({
          change: lastChange,
          newRating: profile.glickoRating,
        });
      } catch { /* non-critical */ }
    }, 2500);
    return () => clearTimeout(timer);
  }, [gameOver]);

  // ── Voice TTS wrapper ─────────────────────────────────────────────────────
  const sayMessage = useCallback((text: string, onDone?: () => void) => {
    voiceSpeakingRef.current = true;
    setVoiceIndicator("speaking");
    setVoiceStatusText(text);
    stopSpeaking();
    speak(text, () => {
      voiceSpeakingRef.current = false;
      setVoiceIndicator("idle");
      onDone?.();
    });
  }, []);

  // ── Voice recognition core ────────────────────────────────────────────────
  const startVoiceListening = useCallback(() => {
    if (!SR || gameOverRef.current || voiceSpeakingRef.current) return;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { }
      recognitionRef.current = null;
    }

    const r = new SR();
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 5;
    recognitionRef.current = r;

    r.onstart = () => {
      setVoiceListening(true);
      setVoiceIndicator("listening");
      setVoiceTranscript("");
      setVoiceStatusText("Listening... speak your move");
    };

    r.onresult = (event: any) => {
      const results = Array.from(event.results[0]) as any[];
      const transcripts: string[] = results.map((res: any) => String(res.transcript));
      const isFinal = event.results[0].isFinal;

      setVoiceTranscript(transcripts[0]);
      if (!isFinal) return;

      setVoiceIndicator("processing");
      setVoiceStatusText("Processing...");

      const myTurnNow = isMultiplayer
        ? gameRef.current.turn() === (myColorRef.current === "white" ? "w" : "b")
        : gameRef.current.turn() === "w";

      if (!myTurnNow || gameOverRef.current || voiceSpeakingRef.current) {
        setVoiceListening(false); setVoiceIndicator("idle");
        return;
      }

      let parsedMove: ReturnType<typeof parseVoiceMove> = null;
      for (const t of transcripts) {
        parsedMove = parseVoiceMove(t, gameRef.current);
        if (parsedMove) break;
      }

      if (parsedMove) {
        const success = applyMove({ from: parsedMove.from, to: parsedMove.to, promotion: parsedMove.promotion || "q" }, "voice");
        if (success) {
          setVoiceListening(false); setVoiceIndicator("idle");
          setVoiceStatusText("Move played.");
          voiceActiveRef.current = false;
          return;
        }
        const suggestions = getSuggestions(gameRef.current);
        const msg = suggestions
          ? `Illegal move. Try ${suggestions}.`
          : "That move is illegal. Please try another move.";
        sayMessage(msg, () => {
          if (voiceActiveRef.current && !gameOverRef.current) startVoiceListening();
        });
        return;
      }

      const raw = transcripts[0];
      const looksLike = /\b[a-h][1-8]?\b|\bknight|bishop|rook|queen|king|castle|pawn\b/i.test(raw);
      if (!raw.trim() || raw.trim().length < 2) {
        sayMessage("I didn't catch that. Please say your move.", () => {
          if (voiceActiveRef.current && !gameOverRef.current) startVoiceListening();
        });
      } else if (looksLike) {
        const suggestions = getSuggestions(gameRef.current);
        const msg = suggestions
          ? `Didn't understand. You could try ${suggestions}.`
          : "Didn't understand. Try saying a square like E four, or knight to F three.";
        sayMessage(msg, () => {
          if (voiceActiveRef.current && !gameOverRef.current) startVoiceListening();
        });
      } else {
        sayMessage("Please say a chess move, like E four or knight to F three.", () => {
          if (voiceActiveRef.current && !gameOverRef.current) startVoiceListening();
        });
      }
    };

    r.onerror = (event: any) => {
      const err = event.error;
      if (err === "no-speech") {
        setVoiceListening(false); setVoiceIndicator("idle");
        if (voiceActiveRef.current && !gameOverRef.current && !voiceSpeakingRef.current) {
          setTimeout(() => { if (voiceActiveRef.current) startVoiceListening(); }, 400);
        }
        return;
      }
      if (err === "aborted") { setVoiceListening(false); setVoiceIndicator("idle"); return; }
      setVoiceListening(false); setVoiceIndicator("idle");
      setVoiceStatusText(`Mic error: ${err}. Tap to retry.`);
    };

    r.onend = () => { setVoiceListening(false); };

    try { r.start(); } catch (e) { console.warn("Voice start failed:", e); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiplayer, sayMessage]);

  const stopVoiceListening = useCallback(() => {
    voiceActiveRef.current = false;
    stopSpeaking(); voiceSpeakingRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { }
      recognitionRef.current = null;
    }
    setVoiceListening(false); setVoiceIndicator("idle");
    setVoiceStatusText("Waiting for your turn...");
  }, []);

  // ── Auto-activate voice when it's my turn ─────────────────────────────────
  const activateVoiceForMyTurn = useCallback((isStart: boolean = false) => {
    if (!SR || gameOverRef.current) return;
    voiceActiveRef.current = true;
    const msg = isStart ? "Game started. Your turn. Speak your move." : "Your turn. Speak your move.";
    sayMessage(msg, () => {
      if (voiceActiveRef.current && !gameOverRef.current) startVoiceListening();
    });
  }, [sayMessage, startVoiceListening]);

  // ── Announce opponent move then activate voice ────────────────────────────
  const announceOpponentMoveAndActivate = useCallback((
    san: string,
    prefix: string = "",
    delayMs: number = 500
  ) => {
    if (!SR || gameOverRef.current) return;
    voiceActiveRef.current = true;
    const moveWords = sanToWords(san);
    const checkPart = prefix ? ` ${prefix}` : "";
    const fullMsg = `Opponent played ${moveWords}.${checkPart} Your turn. Speak your move.`;
    setTimeout(() => {
      if (gameOverRef.current) return;
      sayMessage(fullMsg, () => {
        if (voiceActiveRef.current && !gameOverRef.current) startVoiceListening();
      });
    }, delayMs);
  }, [sayMessage, startVoiceListening]);

  // ── Core move applicator ──────────────────────────────────────────────────
  const applyMove = useCallback((
    moveInput: string | { from: string; to: string; promotion?: string },
    source: "board" | "ai" | "voice"
  ): boolean => {
    if (gameOverRef.current) return false;
    const game = gameRef.current;
    let move: Move | null = null;
    try { move = typeof moveInput === "string" ? game.move(moveInput) : game.move(moveInput); } catch { move = null; }
    if (!move) { setStatusMessage("Illegal move — try again"); return false; }

    setFen(game.fen());
    setMoveHistory(prev => [...prev, move!.san]);
    setLastMove({ from: move.from, to: move.to });
    setGameHistory(prev => [...prev, { id: Date.now(), move: move!.san, timestamp: Date.now(), player: move!.color === "w" ? "white" : "black" }]);

    if (move.captured) {
      const sym = move.captured.toUpperCase();
      setCapturedPieces(prev => { const n = { ...prev }; if (move!.color === "w") n.black.push(sym); else n.white.push(sym); return n; });
    }

    if (gameRecorderRef.current) {
      gameRecorderRef.current.recordMove(moveInput);
      if (move.color === "w") gameRecorderRef.current.updateTime("black", blackTimeRef.current * 1000);
      else gameRecorderRef.current.updateTime("white", whiteTimeRef.current * 1000);
    }

    if (!clockStartedRef.current) { clockStartedRef.current = true; setClockStarted(true); }

    const sideToMove = game.turn();
    if (incrementRef.current > 0) {
      if (sideToMove === "b") setWhiteTime(p => p + incrementRef.current);
      else setBlackTime(p => p + incrementRef.current);
    }

    if (isMultiplayer && (source === "board" || source === "voice")) {
      sendMessage({ type: "MOVE", from: move.from, to: move.to, promotion: move.promotion || null, san: move.san, fen: game.fen(), turn: sideToMove === "w" ? "white" : "black", player: myColorRef.current });
    }

    if (game.isCheckmate()) {
      const winColor = sideToMove === "w" ? "Black" : "White";
      setGameOver(true); gameOverRef.current = true; setWinner(winColor);
      setStatusMessage(`Checkmate! ${winColor} wins!`);
      if (isMultiplayer) {
        const iWin = winColor.toLowerCase() === myColorRef.current;
        setGameResult(iWin ? "You win! by checkmate" : "You lose! by checkmate");
        sendMessage({ type: "GAME_OVER", winner: winColor.toLowerCase(), reason: "Checkmate", movesJson: gameRecorderRef.current?.getMovesAsJSON() ?? null });
      }
      stopVoiceListening();
      sayMessage(isMultiplayer ? (winColor.toLowerCase() === myColorRef.current ? "You win by checkmate!" : "You lose by checkmate.") : `Checkmate! ${winColor} wins!`);
      playSound("gameEnd");
    } else if (game.isDraw()) {
      let msg = "Game drawn"; let reason = "Draw";
      if (game.isStalemate()) { msg = "Stalemate! Game drawn"; reason = "Stalemate"; }
      else if (game.isThreefoldRepetition()) { msg = "Draw by repetition"; reason = "Threefold repetition"; }
      else if (game.isInsufficientMaterial()) { msg = "Draw by insufficient material"; reason = "Insufficient material"; }
      setGameOver(true); gameOverRef.current = true; setWinner(null); setStatusMessage(msg);
      if (isMultiplayer) { setGameResult("Draw!"); sendMessage({ type: "GAME_OVER", winner: "draw", reason, movesJson: gameRecorderRef.current?.getMovesAsJSON() ?? null }); }
      stopVoiceListening(); sayMessage("The game is a draw."); playSound("gameEnd");
    } else if (game.isCheck()) {
      const isMyTurnNow = isMultiplayer ? sideToMove === (myColorRef.current === "white" ? "w" : "b") : true;
      setStatusMessage("Check!");
      playSound("check");
      if (isMultiplayer && isMyTurnNow) {
        setTimeout(() => activateVoiceForMyTurn(), 800);
      }
    } else {
      setStatusMessage(
        isMultiplayer
          ? (sideToMove === (myColorRef.current === "white" ? "w" : "b") ? "Your turn" : "Opponent's turn")
          : (sideToMove === "w" ? "White to move" : "Black to move")
      );
      playSound(move.captured ? "capture" : "move");

      if (!isMultiplayer && source === "ai") {
        const aiMoveWords = sanToWords(move.san);
        sayMessage(`AI played ${aiMoveWords}.`);
      }

      if (!isMultiplayer && sideToMove === "b" && source !== "ai" && !gameOverRef.current) {
        setTimeout(() => makeAIMove(), 800);
      }
    }

    setCurrentTurn(game.turn()); currentTurnRef.current = game.turn();
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiplayer, playSound, sendMessage, stopVoiceListening, sayMessage, activateVoiceForMyTurn]);

  // ── WebSocket message handler ──────────────────────────────────────────────
  const handleServerMessage = useCallback((data: any) => {
    switch (data.type) {
      case "WAITING_FOR_OPPONENT":
        setMpConnectionStatus("waiting");
        setStatusMessage("Waiting for opponent to connect...");
        break;

      case "GAME_START": {
        let tc: string = (data.timeControl as string) || mpState?.timeControl || "10+0";
        tc = tc.replace("%2B", "+").replace("%2b", "+");
        setEffectiveTimeControl(tc);
        gameRecorderRef.current = new GameRecorder(tc);
        const [mainPart, incStr] = tc.split("+");
        const mins = Number(mainPart) || 10;
        const inc = Number(incStr) || 0;
        const secs = Math.max(60, mins * 60);

        gameRef.current = new Chess();
        setFen(gameRef.current.fen());
        setMoveHistory([]); setGameHistory([]); setLastMove(null);
        setCapturedPieces({ white: [], black: [] });
        setGameOver(false); setGameResult(null); gameOverRef.current = false;
        setWhiteTime(secs); setBlackTime(secs);
        whiteTimeRef.current = secs; blackTimeRef.current = secs;
        setIncrement(inc); incrementRef.current = inc;
        whiteTimeWarned30.current = false; whiteTimeWarned10.current = false;
        blackTimeWarned30.current = false; blackTimeWarned10.current = false;

        const myCol = (data.myColor as "white" | "black") || mpState?.color || "white";
        myColorRef.current = myCol;
        clockStartedRef.current = true; setClockStarted(true);
        gameStartedRef.current = true;
        setCurrentTurn("w"); currentTurnRef.current = "w";
        setMpConnectionStatus("playing");

        const isMyFirst = myCol === "white";
        setStatusMessage(isMyFirst ? "Your turn — speak your move!" : "Opponent's turn");

        if (isMyFirst) {
          setTimeout(() => activateVoiceForMyTurn(true), 1000);
        } else {
          setVoiceStatusText("Waiting for opponent...");
          voiceActiveRef.current = false;
        }
        break;
      }

      case "MOVE": {
        const game = gameRef.current;
        try {
          const move = game.move({ from: data.from, to: data.to, promotion: data.promotion || "q" });
          if (move) {
            setFen(game.fen()); setLastMove({ from: data.from, to: data.to });
            setMoveHistory(prev => [...prev, move.san]);
            setGameHistory(prev => [...prev, { id: Date.now(), move: move.san, timestamp: Date.now(), player: move.color === "w" ? "white" : "black" }]);
            if (move.captured) { const s = move.captured.toUpperCase(); setCapturedPieces(prev => { const n = { ...prev }; if (move.color === "w") n.black.push(s); else n.white.push(s); return n; }); }
            if (gameRecorderRef.current) { gameRecorderRef.current.recordMove(move.san); }
            if (incrementRef.current > 0) { const mc = data.player as "white" | "black"; if (mc === "white") setWhiteTime(p => p + incrementRef.current); else setBlackTime(p => p + incrementRef.current); }

            const nextTurn = data.turn as "white" | "black";
            const nextChar = nextTurn === "white" ? "w" : "b";
            setCurrentTurn(nextChar); currentTurnRef.current = nextChar;

            const isMyNow = nextChar === (myColorRef.current === "white" ? "w" : "b");

            if (game.isCheckmate()) {
              const mover = data.player as string;
              const iWin = mover === myColorRef.current;
              setGameOver(true); gameOverRef.current = true;
              setGameResult(iWin ? "You win! by checkmate" : "You lose! by checkmate");
              setStatusMessage("Checkmate!");
              stopVoiceListening();
              const moveWords = sanToWords(move.san);
              sayMessage(iWin ? `Opponent played ${moveWords}. Checkmate! You win!` : `Opponent played ${moveWords}. Checkmate. You lose.`);
              playSound("gameEnd");
            } else if (game.isDraw()) {
              const moveWords = sanToWords(move.san);
              setGameOver(true); gameOverRef.current = true;
              setGameResult("Draw!"); setStatusMessage("Game drawn");
              stopVoiceListening();
              sayMessage(`Opponent played ${moveWords}. The game is a draw.`);
              playSound("gameEnd");
            } else if (game.isCheck()) {
              playSound("check");
              setStatusMessage(isMyNow ? "Check! Your turn." : "Check!");
              if (isMyNow) {
                announceOpponentMoveAndActivate(move.san, "Check!", 800);
              }
            } else {
              playSound(move.captured ? "capture" : "move");
              setStatusMessage(isMyNow ? "Your turn — speak your move!" : "Opponent's turn");
              if (isMyNow) {
                announceOpponentMoveAndActivate(move.san, "", 500);
              } else {
                voiceActiveRef.current = false;
                setVoiceStatusText("Waiting for opponent...");
                setVoiceIndicator("idle");
              }
            }
          }
        } catch (e) { console.error("Error applying opponent move:", e); }
        break;
      }

      case "GAME_OVER": {
        if (!gameStartedRef.current || gameOverRef.current) break;
        setGameOver(true); gameOverRef.current = true;
        const w = data.winner as string;
        const reason = (data.reason as string) || "Game over";
        if (w === "draw" || data.result === "DRAW") {
          setGameResult(`Draw — ${reason}`); setWinner(null);
          sayMessage("The game is a draw.");
        } else {
          const iWin = (w === "white" && myColorRef.current === "white") || (w === "black" && myColorRef.current === "black");
          setGameResult(iWin ? "You win!" : "You lose!");
          setWinner(iWin ? "You" : "Opponent");
          sayMessage(iWin ? "You win!" : "You lose.");
        }
        setStatusMessage(reason);
        stopVoiceListening();
        break;
      }

      case "DRAW_OFFER":
        setDrawOfferReceived(true);
        setStatusMessage("Opponent offers a draw");
        sayMessage("Your opponent offers a draw. Say accept or decline.");
        break;

      case "DRAW_DECLINED":
        setStatusMessage("Draw offer declined");
        setTimeout(() => {
          const isMyNow = currentTurnRef.current === (myColorRef.current === "white" ? "w" : "b");
          setStatusMessage(isMyNow ? "Your turn — speak your move!" : "Opponent's turn");
        }, 2000);
        break;

      case "OPPONENT_DISCONNECTED":
        setStatusMessage("Opponent disconnected");
        setMpConnectionStatus("disconnected");
        stopVoiceListening();
        sayMessage("Your opponent has disconnected.");
        break;
    }
  }, [mpState?.timeControl, mpState?.color, sendMessage, playSound, stopVoiceListening, sayMessage, activateVoiceForMyTurn, announceOpponentMoveAndActivate]);

  // ── WebSocket connection ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isMultiplayer || !mpState?.gameId) return;
    let cancelled = false;
    const connect = async () => {
      const token = await getAccessToken();
      if (!token || cancelled) return;
      const ws = new WebSocket(`ws://localhost:8080/api/game/${mpState.gameId}?token=${token}`);
      wsRef.current = ws;
      setMpConnectionStatus("connecting");
      ws.onopen = () => { if (!cancelled) { setMpConnectionStatus("waiting"); setStatusMessage("Waiting for opponent..."); } };
      ws.onmessage = (e) => { if (!cancelled) { try { handleServerMessage(JSON.parse(e.data)); } catch { } } };
      ws.onerror = () => { if (!cancelled) setMpConnectionStatus("disconnected"); };
      ws.onclose = () => { if (!cancelled && !gameOverRef.current) { setMpConnectionStatus("disconnected"); setStatusMessage("Connection lost"); } };
    };
    connect();
    return () => { cancelled = true; wsRef.current?.close(); };
  }, [isMultiplayer, mpState?.gameId, handleServerMessage]);

  // Solo: auto-listen for white on first load
  useEffect(() => {
    if (isMultiplayer) return;
    if (!SR) return;
    const timer = setTimeout(() => {
      if (!gameOverRef.current && gameRef.current.turn() === "w") {
        voiceActiveRef.current = true;
        startVoiceListening();
      }
    }, 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiplayer]);

  // Before unload: resign
  useEffect(() => {
    if (!isMultiplayer) return;
    const onUnload = () => { if (gameStartedRef.current && !gameOverRef.current && wsRef.current?.readyState === WebSocket.OPEN) sendMessage({ type: "RESIGN" }); };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [isMultiplayer, sendMessage]);

  // AI move
  const makeAIMove = useCallback(async () => {
    if (gameOverRef.current || isMultiplayer) return;
    try {
      const m = await stockfishService.getBestMove(gameRef.current.fen(), 3);
      if (m) applyMove(m, "ai");
      else {
        const legal = gameRef.current.moves();
        if (legal.length) applyMove(legal[Math.floor(Math.random() * legal.length)], "ai");
      }
    } catch {
      const legal = gameRef.current.moves();
      if (legal.length) applyMove(legal[Math.floor(Math.random() * legal.length)], "ai");
    }
  }, [isMultiplayer, applyMove]);

  // After AI moves in solo, re-activate voice for white
  useEffect(() => {
    if (isMultiplayer) return;
    if (!gameOver && currentTurn === "w" && clockStarted) {
      const timer = setTimeout(() => {
        if (!gameOverRef.current && gameRef.current.turn() === "w" && !voiceSpeakingRef.current) {
          voiceActiveRef.current = true;
          startVoiceListening();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTurn, gameOver, clockStarted, isMultiplayer]);

  // Game handlers
  const handleFlag = useCallback((flagged: "white" | "black") => {
    if (gameOverRef.current) return;
    const winColor = flagged === "white" ? "Black" : "White";
    setGameOver(true); gameOverRef.current = true; setWinner(winColor);
    setStatusMessage(`Time's up! ${winColor} wins on time!`);
    stopVoiceListening(); sayMessage(`Time's up. ${winColor} wins.`); playSound("gameEnd");
    if (isMultiplayer) sendMessage({ type: "FLAG", player: flagged });
  }, [isMultiplayer, playSound, sendMessage, stopVoiceListening, sayMessage]);

  const handleNewGame = useCallback(() => {
    if (isMultiplayer) return;
    gameRef.current = new Chess(); setFen(gameRef.current.fen());
    setMoveHistory([]); setGameHistory([]); setStatusMessage("White to move");
    setCurrentTurn("w"); currentTurnRef.current = "w";
    setGameOver(false); setWinner(null); setGameResult(null); gameOverRef.current = false;
    clockStartedRef.current = false; setClockStarted(false); setLastMove(null);
    setCapturedPieces({ white: [], black: [] }); setVoiceTranscript("");
    setRatingChange(null);
    const mins = Number(effectiveTimeControl.split("+")[0].split("/")[0]) || 0;
    const secs = mins * 60;
    setWhiteTime(secs); setBlackTime(secs); whiteTimeRef.current = secs; blackTimeRef.current = secs;
    whiteTimeWarned30.current = false; whiteTimeWarned10.current = false;
    blackTimeWarned30.current = false; blackTimeWarned10.current = false;
    voiceActiveRef.current = false;
  }, [isMultiplayer, effectiveTimeControl]);

  const handleUndo = useCallback(() => {
    if (gameOverRef.current || isMultiplayer || moveHistory.length < 2) return;
    gameRef.current.undo(); gameRef.current.undo();
    setFen(gameRef.current.fen()); setMoveHistory(p => p.slice(0, -2));
    setGameHistory(p => p.slice(0, -2)); setLastMove(null);
    setStatusMessage("Move undone"); setCurrentTurn(gameRef.current.turn()); currentTurnRef.current = gameRef.current.turn();
  }, [isMultiplayer, moveHistory.length]);

  const handleOfferDraw = useCallback(() => {
    if (gameOverRef.current) return;
    if (isMultiplayer) { sendMessage({ type: "OFFER_DRAW" }); setStatusMessage("Draw offer sent..."); }
    else {
      if (Math.random() > 0.5) { setGameOver(true); gameOverRef.current = true; setWinner(null); setStatusMessage("Draw agreed"); playSound("gameEnd"); sayMessage("Draw agreed."); }
      else { setStatusMessage("AI declined the draw offer"); sayMessage("AI declined your draw offer."); setTimeout(() => setStatusMessage(currentTurnRef.current === "w" ? "White to move" : "Black to move"), 2000); }
    }
  }, [isMultiplayer, playSound, sendMessage, sayMessage]);

  const handleResign = useCallback(() => {
    if (gameOverRef.current) return;
    if (isMultiplayer) { if (confirm("Are you sure you want to resign?")) { sendMessage({ type: "RESIGN" }); stopVoiceListening(); } }
    else { setGameOver(true); gameOverRef.current = true; setWinner("Black"); setStatusMessage("You resigned. Black wins!"); playSound("gameEnd"); stopVoiceListening(); sayMessage("You resigned."); }
  }, [isMultiplayer, playSound, sendMessage, stopVoiceListening, sayMessage]);

  const onDrop = useCallback((sourceSquare: string, targetSquare: string) => {
    if (gameOverRef.current) return false;
    if (isMultiplayer) {
      if (!gameStartedRef.current) return false;
      if (gameRef.current.turn() !== (myColorRef.current === "white" ? "w" : "b")) return false;
    } else {
      if (gameRef.current.turn() !== "w") return false;
    }
    return applyMove({ from: sourceSquare, to: targetSquare, promotion: "q" }, "board");
  }, [isMultiplayer, applyMove]);

  const getSquareStyles = useCallback(() => {
    if (!showLegalMoves || !lastMove) return {};
    return { [lastMove.from]: { backgroundColor: "rgba(255,255,0,0.4)" }, [lastMove.to]: { backgroundColor: "rgba(255,255,0,0.4)" } };
  }, [showLegalMoves, lastMove]);

  // Save game (solo)
  const saveGameToDB = useCallback(async (result: "WIN" | "LOSS" | "DRAW", reason: string) => {
    if (!gameRecorderRef.current) return;
    setIsSavingGame(true);
    try {
      const val = gameRecorderRef.current.validateMoves();
      if (!val.valid) return;
      const pgn = gameRecorderRef.current.generatePGN("You (White)", "ChessMaster AI", result, effectiveTimeControl, "VOICE", reason);
      const stats = gameRecorderRef.current.getGameStats();
      await gameService.saveGame({ opponentName: "ChessMaster AI", result, pgn, movesJson: gameRecorderRef.current.getMovesAsJSON(), whiteRating: 1847, blackRating: 1923, timeControl: effectiveTimeControl, gameType: "VOICE", terminationReason: reason, moveCount: stats.moveCount, totalTimeWhiteMs: stats.whiteTimeUsedMs, totalTimeBlackMs: stats.blackTimeUsedMs, accuracyPercentage: 75 + Math.floor(Math.random() * 20) });
    } catch { /* ignore */ } finally { setIsSavingGame(false); }
  }, [effectiveTimeControl]);

  useEffect(() => {
    if (!gameOver || isSavingGame || isMultiplayer) return;
    let result: "WIN" | "LOSS" | "DRAW" = "DRAW", reason = "DRAW";
    if (winner === "White") { result = "WIN"; reason = "CHECKMATE"; }
    else if (winner === "Black") { result = "LOSS"; reason = "CHECKMATE"; }
    else if (statusMessage.includes("Stalemate")) reason = "STALEMATE";
    setTimeout(() => saveGameToDB(result, reason), 500);
  }, [gameOver, isSavingGame, isMultiplayer, winner, statusMessage, saveGameToDB]);

  // Clock
  useEffect(() => {
    if (gameOver || isPaused || !clockStarted) return;
    const id = window.setInterval(() => {
      if (currentTurnRef.current === "w") {
        setWhiteTime(p => { const n = p - 1; whiteTimeRef.current = n; if (p <= 1) { handleFlag("white"); return 0; } return n; });
      } else {
        setBlackTime(p => { const n = p - 1; blackTimeRef.current = n; if (p <= 1) { handleFlag("black"); return 0; } return n; });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [currentTurn, gameOver, isPaused, clockStarted, handleFlag]);

  const handleBack = useCallback(() => {
    if (isMultiplayer && gameStartedRef.current && !gameOverRef.current) {
      wsRef.current?.readyState === WebSocket.OPEN && sendMessage({ type: "RESIGN" });
      gameOverRef.current = true;
    }
    stopVoiceListening();
    if (window.history.length > 1) navigate(-1); else navigate("/home");
  }, [isMultiplayer, navigate, sendMessage, stopVoiceListening]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const opponentDisplayName = isMultiplayer ? mpState?.opponentName || "Opponent" : "ChessMaster AI";
  const opponentColor = myColor === "white" ? "black" : "white";
  const opponentClock = myColor === "white" ? blackTime : whiteTime;
  const myClock = myColor === "white" ? whiteTime : blackTime;

  const isMyTurnNow = isMultiplayer
    ? gameStartedRef.current && gameRef.current.turn() === (myColor === "white" ? "w" : "b")
    : gameRef.current.turn() === "w";

  const isDraggable = isMultiplayer
    ? !gameOver && gameStartedRef.current && gameRef.current.turn() === (myColor === "white" ? "w" : "b") && !isPaused
    : !gameOver && gameRef.current.turn() === "w" && !isPaused;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Navbar rating={1847} streak={5} />
      <div className="voice-game-page">
        <div className="voice-back-row">
          <button className="voice-back-btn" onClick={handleBack}>← Back</button>
          {isMultiplayer && (
            <span style={{ marginLeft: 16, padding: "4px 14px", borderRadius: 20, fontSize: "0.8rem", fontWeight: 600, border: "1px solid currentColor", color: mpConnectionStatus === "playing" ? "#00c864" : mpConnectionStatus === "waiting" ? "#ffc800" : "#ff5050" }}>
              {mpConnectionStatus === "playing" ? "● Live" : mpConnectionStatus === "waiting" ? "⏳ Waiting" : mpConnectionStatus === "connecting" ? "⟳ Connecting" : "✕ Disconnected"}
            </span>
          )}
        </div>

        <div className="voice-top-bar">
          <div className="voice-top-left">
            <div className="voice-top-title-row">
              <span className={`voice-dot ${voiceListening ? "listening" : ""}`} />
              <span className="voice-top-title">{isMultiplayer ? "Multiplayer Voice Chess" : "Voice Chess"}</span>
              <span className="voice-top-badge">{isMultiplayer ? "VS Player" : "VS AI"}</span>
              <span className="voice-top-badge" style={{ background: voiceListening ? "rgba(255,80,80,0.2)" : "rgba(100,100,255,0.2)", color: voiceListening ? "#ff8080" : "#aaf", border: "1px solid currentColor" }}>
                {voiceListening ? "🎤 Listening..." : voiceIndicator === "speaking" ? "🔊 Speaking" : voiceIndicator === "processing" ? "⏳ Processing" : "🎤 Voice Mode"}
              </span>
            </div>
            <div className="voice-top-subtitle">
              {isMultiplayer
                ? <><strong style={{ color: myColor === "white" ? "#fff" : "#aaa" }}>{myColor}</strong> — {statusMessage}</>
                : <>Time: <span className="voice-top-subtitle-strong">{effectiveTimeControl}</span> | {statusMessage}</>
              }
            </div>
          </div>
          <div className="voice-top-right">
            {!isMultiplayer && (
              <>
                <button className="voice-top-button" onClick={() => setIsPaused(p => !p)} disabled={gameOver}>{isPaused ? "▶ Resume" : "⏸ Pause"}</button>
                <button className="voice-top-button" onClick={handleNewGame}>🔄 New Game</button>
              </>
            )}
          </div>
        </div>

        <div className="voice-main-layout">
          {/* LEFT: Board */}
          <div className="voice-left-column">

            {isMultiplayer && (
              <div className="voice-player-card" style={{ marginBottom: 8 }}>
                <div className="player-left">
                  <div className="player-avatar ai">{(opponentDisplayName[0] || "?").toUpperCase()}</div>
                  <div><div className="player-name">{opponentDisplayName}</div><div className="player-rating">{opponentColor === "black" ? "⬛ Black" : "⬜ White"}</div></div>
                </div>
                <div className={`player-clock${opponentClock <= 30 && clockStarted ? " low-time" : ""}${opponentClock <= 10 && clockStarted ? " critical-time" : ""}`}>{formatTime(opponentClock)}</div>
              </div>
            )}

            <div className="voice-board-card">
              <Chessboard
                position={fen}
                onPieceDrop={onDrop}
                boardOrientation={isMultiplayer ? myColor : boardOrientation}
                boardWidth={boardWidth}
                arePiecesDraggable={isDraggable}
                customSquareStyles={getSquareStyles()}
                customBoardStyle={{ borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.9)" }}
              />
              <div className="voice-board-footer">
                {!isMultiplayer && <button className="voice-small-btn" onClick={() => setBoardOrientation(p => p === "white" ? "black" : "white")}>🔄 Flip</button>}
                <button className="voice-small-btn" onClick={() => setShowLegalMoves(p => !p)}>{showLegalMoves ? "👁 Hide Hints" : "👁 Show Hints"}</button>
                <button className="voice-small-btn" onClick={() => setIsSoundOn(p => !p)}>{isSoundOn ? "🔊 On" : "🔇 Off"}</button>
              </div>
            </div>

            {isMultiplayer && (
              <div className="voice-player-card" style={{ marginTop: 8 }}>
                <div className="player-left">
                  <div className="player-avatar you">Y</div>
                  <div><div className="player-name">You</div><div className="player-rating">{myColor === "white" ? "⬜ White" : "⬛ Black"}</div></div>
                </div>
                <div className={`player-clock${myClock <= 30 && clockStarted ? " low-time" : ""}${myClock <= 10 && clockStarted ? " critical-time" : ""}`}>{formatTime(myClock)}</div>
              </div>
            )}

            <div className="voice-board-footer" style={{ marginTop: 8 }}>
              {!isMultiplayer && <button className="voice-small-btn" onClick={handleUndo} disabled={gameOver || moveHistory.length < 2}>↩ Undo</button>}
              <button className="voice-small-btn" onClick={handleOfferDraw} disabled={gameOver || (isMultiplayer && !gameStartedRef.current)}>🤝 Draw</button>
              <button className="voice-small-btn" onClick={handleResign} disabled={gameOver || (isMultiplayer && !gameStartedRef.current)} style={{ borderColor: "rgba(255,80,80,0.5)", color: "#ff8888" }}>🏳 Resign</button>
            </div>

            {drawOfferReceived && (
              <div style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: "#ffe58a", flex: 1 }}>🤝 Opponent offers a draw</span>
                <button className="voice-small-btn" onClick={() => { sendMessage({ type: "ACCEPT_DRAW" }); setDrawOfferReceived(false); }} style={{ maxWidth: 80, color: "#65ffb3", borderColor: "rgba(100,255,160,0.5)" }}>Accept</button>
                <button className="voice-small-btn" onClick={() => { sendMessage({ type: "DECLINE_DRAW" }); setDrawOfferReceived(false); }} style={{ maxWidth: 80, color: "#ff8888", borderColor: "rgba(255,80,80,0.4)" }}>Decline</button>
              </div>
            )}
          </div>

          {/* RIGHT: Voice panel + info */}
          <div className="voice-right-column">

            {/* ── Voice Status Panel ── */}
            <div style={{ background: "linear-gradient(135deg, rgba(30,22,14,0.97), rgba(18,14,8,0.97))", border: `1px solid ${voiceListening ? "rgba(255,80,80,0.6)" : voiceIndicator === "speaking" ? "rgba(80,160,255,0.5)" : "rgba(255,215,0,0.25)"}`, borderRadius: 20, padding: "16px 18px", boxShadow: "0 12px 32px rgba(0,0,0,0.8)", transition: "border-color 0.3s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, background: voiceListening ? "rgba(255,50,50,0.25)" : voiceIndicator === "speaking" ? "rgba(50,120,255,0.2)" : "rgba(40,40,40,0.6)", border: `1px solid ${voiceListening ? "rgba(255,80,80,0.6)" : "rgba(255,255,255,0.1)"}`, transition: "all 0.3s", animation: voiceListening ? "pulse-icon 1.2s ease-in-out infinite" : "none" }}>
                  {voiceListening ? "🎤" : voiceIndicator === "speaking" ? "🔊" : voiceIndicator === "processing" ? "⏳" : "🎙"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.75rem", color: "#ffdd88", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 2 }}>
                    {voiceListening ? "● Listening" : voiceIndicator === "speaking" ? "Speaking" : voiceIndicator === "processing" ? "Processing" : "Voice Ready"}
                  </div>
                  <div style={{ fontSize: "0.88rem", color: "#e0e0e0" }}>{voiceStatusText}</div>
                </div>
              </div>

              {voiceTranscript && (
                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "8px 12px", marginBottom: 10, borderLeft: "3px solid rgba(255,215,0,0.5)" }}>
                  <div style={{ fontSize: "0.7rem", color: "#ffdd88", marginBottom: 2 }}>HEARD</div>
                  <div style={{ fontSize: "0.9rem", color: "#fff", fontStyle: "italic" }}>"{voiceTranscript}"</div>
                </div>
              )}

              {!voiceSupported && (
                <div style={{ color: "#ff8888", fontSize: "0.82rem", background: "rgba(255,80,80,0.08)", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,80,80,0.2)" }}>
                  ⚠ Speech recognition not supported in this browser. Use Chrome or Edge.
                </div>
              )}

              {voiceSupported && !voiceListening && !gameOver && (
                <button
                  onClick={() => { if (isMyTurnNow && !voiceSpeakingRef.current) { voiceActiveRef.current = true; startVoiceListening(); } }}
                  disabled={!isMyTurnNow || voiceIndicator === "speaking" || voiceIndicator === "processing"}
                  style={{ width: "100%", padding: "9px 0", borderRadius: 12, border: `1px solid ${isMyTurnNow ? "rgba(255,215,0,0.5)" : "rgba(255,255,255,0.1)"}`, background: isMyTurnNow ? "rgba(255,215,0,0.12)" : "rgba(40,40,40,0.4)", color: isMyTurnNow ? "#ffd700" : "#666", fontSize: "0.85rem", fontWeight: 600, cursor: isMyTurnNow ? "pointer" : "not-allowed", transition: "all 0.3s" }}>
                  {isMyTurnNow ? "🎤 Tap to Speak" : "Waiting for your turn..."}
                </button>
              )}

              {voiceListening && (
                <button onClick={stopVoiceListening} style={{ width: "100%", padding: "9px 0", borderRadius: 12, border: "1px solid rgba(255,80,80,0.5)", background: "rgba(255,50,50,0.15)", color: "#ff8888", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}>
                  ⏹ Stop Listening
                </button>
              )}

              <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(0,0,0,0.3)", borderRadius: 10 }}>
                <div style={{ fontSize: "0.72rem", color: "#ffdd88", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>How to speak moves</div>
                {[["Square to square", '"e two e four"'], ["Piece + square", '"knight to f three"'], ["Captures", '"bishop takes d five"'], ["Castling", '"castle kingside"']].map(([label, ex]) => (
                  <div key={label} style={{ fontSize: "0.78rem", color: "#c0c0c0", marginBottom: 3, display: "flex", gap: 6 }}>
                    <span style={{ color: "#888", minWidth: 100 }}>{label}</span>
                    <span style={{ color: "#ffe78b" }}>{ex}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Clocks (solo) */}
            {!isMultiplayer && (
              <div style={{ background: "linear-gradient(135deg, rgba(28,22,14,0.95), rgba(18,14,8,0.95))", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 16, padding: "12px 16px", display: "flex", gap: 16, alignItems: "center" }}>
                {[{ label: "⬛ Black", time: blackTime, active: currentTurn === "b" }, { label: "⬜ White", time: whiteTime, active: currentTurn === "w" }].map(({ label, time, active }) => (
                  <div key={label} style={{ flex: 1, textAlign: "center", background: active && clockStarted ? "rgba(255,215,0,0.08)" : "transparent", borderRadius: 10, padding: "8px 0", border: active && clockStarted ? "1px solid rgba(255,215,0,0.3)" : "1px solid transparent", transition: "all 0.3s" }}>
                    <div style={{ fontSize: "0.72rem", color: "#999", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontFamily: "monospace", fontSize: "1.3rem", fontWeight: 700, color: time <= 10 && clockStarted ? "#ff4444" : time <= 30 && clockStarted ? "#ffaa44" : "#ffe77a" }}>{formatTime(time)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Waiting state */}
            {isMultiplayer && !gameStartedRef.current && mpConnectionStatus !== "disconnected" && !gameOver && (
              <div style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 16, padding: 24, textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: 8 }}>⏳</div>
                <div style={{ color: "#ffd700", fontWeight: 600, marginBottom: 8 }}>{mpConnectionStatus === "waiting" ? "Waiting for opponent..." : "Connecting..."}</div>
                <div style={{ color: "#888", fontSize: "0.85rem" }}>You are <strong style={{ color: myColor === "white" ? "#fff" : "#ccc" }}>{myColor}</strong></div>
              </div>
            )}

            {/* Game over */}
            {gameOver && (
              <div style={{ background: "linear-gradient(135deg, rgba(30,22,14,0.97), rgba(18,14,8,0.97))", border: "1px solid rgba(255,215,0,0.3)", borderRadius: 20, padding: 24, textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🏁</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "#ffd700", marginBottom: 16 }}>
                  {isMultiplayer ? gameResult || "Game Over" : winner ? `${winner} wins!` : "Game drawn"}
                </div>
                <button onClick={() => navigate("/home")} style={{ padding: "10px 28px", borderRadius: 12, border: "1px solid rgba(255,215,0,0.4)", background: "rgba(255,215,0,0.12)", color: "#ffd700", fontWeight: 600, cursor: "pointer", fontSize: "0.9rem" }}>Back to Home</button>
              </div>
            )}

            {/* Move history */}
            <div className="voice-move-history-card">
              <div className="panel-header">
                <span>♟ Move History</span>
                <span style={{ fontSize: "0.75rem", color: "#888" }}>{Math.ceil(moveHistory.length / 2)} moves</span>
              </div>
              <div className="move-history-list">
                {moveHistory.length === 0 && <div className="voice-history-empty">No moves yet. Speak to start!</div>}
                {Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => (
                  <div key={i} className="move-history-item">
                    <span className="move-index">{i + 1}.</span>
                    <span className="move-text">{moveHistory[i * 2]}</span>
                    <span className="move-text" style={{ opacity: 0.7 }}>{moveHistory[i * 2 + 1] || ""}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="voice-status-strip">
              {gameOver ? (isMultiplayer ? gameResult || "Game over" : winner ? `${winner} wins!` : "Game drawn") : (isPaused ? "⏸ Paused" : statusMessage)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Rating Change Popup ──────────────────────────────────────────────── */}
      {ratingChange && (
        <RatingChangePopup
          change={ratingChange.change}
          newRating={ratingChange.newRating}
          onClose={() => setRatingChange(null)}
        />
      )}
    </>
  );
};

export default VoiceGamePage;