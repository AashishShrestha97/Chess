import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Chess, Move } from "chess.js";
import { Chessboard } from "react-chessboard";
import Navbar from "../components/Navbar/Navbar";
import "./VoiceGamePage.css";
import deepgramTTSService from "../utils/deepgramTTSService";
import deepgramVoiceCommandService from "../utils/deepgramVoiceCommandService";
import { GlobalVoiceParser } from "../utils/globalVoiceParser";
import gameService from "../api/games";
import { GameRecorder } from "../utils/gameRecorder";
import beepService from "../utils/beepService";
import { stockfishService } from "../utils/stockfishService";
import { getAccessToken } from "../utils/getAccessToken";

// ---------- Types ----------
interface VoiceGamePageProps {
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

type VoiceStatus = "Executed" | "Error" | "Ignored";

interface VoiceHistoryItem {
  id: number;
  text: string;
  status: VoiceStatus;
  timestamp: number;
}

// ---------- Component ----------
const VoiceGamePage: React.FC<VoiceGamePageProps> = ({
  timeControl = "3+0",
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
  const myColor = mpState?.color ?? "white";
  const myColorRef = useRef<"white" | "black">(myColor);

  const [effectiveTimeControl, setEffectiveTimeControl] =
    useState<string>(timeControl);

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(
    myColor
  );

  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [voiceHistory, setVoiceHistory] = useState<VoiceHistoryItem[]>([]);
  const [lastCommand, setLastCommand] = useState("");
  const [statusMessage, setStatusMessage] = useState(
    isMultiplayer ? "Waiting for opponent..." : "White to move"
  );

  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);
  const [increment, setIncrement] = useState(0);
  const [currentTurn, setCurrentTurn] = useState<"w" | "b">("w");

  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [voicePaused, setVoicePaused] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(true);

  const [boardWidth, setBoardWidth] = useState<number>(480);

  // Multiplayer UI
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [mpConnectionStatus, setMpConnectionStatus] = useState<
    "connecting" | "waiting" | "playing" | "disconnected"
  >("connecting");

  // Game recorder for saving game data (solo only)
  const gameRecorderRef = useRef<GameRecorder | null>(null);
  const [isSavingGame, setIsSavingGame] = useState(false);

  // Intro & voice init guards
  const welcomePlayedRef = useRef(false);
  const voiceInitializedRef = useRef(false);
  const playingIntroRef = useRef(false);

  // Time warning flags
  const whiteTimeWarned30 = useRef(false);
  const whiteTimeWarned10 = useRef(false);
  const blackTimeWarned30 = useRef(false);
  const blackTimeWarned10 = useRef(false);

  const clockStartedRef = useRef(false);
  const gameOverRef = useRef(false);
  const isSoundOnRef = useRef(true);
  const voicePausedRef = useRef(false);
  const incrementRef = useRef(0);
  const currentTurnRef = useRef<"w" | "b">("w");

  // Track last move for better feedback
  const lastMoveRef = useRef<string>("");

  // ------- Basic sync effects -------
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);
  useEffect(() => { isSoundOnRef.current = isSoundOn; }, [isSoundOn]);
  useEffect(() => { voicePausedRef.current = voicePaused; }, [voicePaused]);
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
    setEffectiveTimeControl(tc || timeControl || "3+0");
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
        console.log("✅ Stockfish ready for voice game");
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
        console.log("🎮 Voice Game WS connected");
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

      ws.onerror = () => {
        setMpConnectionStatus("disconnected");
      };

      ws.onclose = () => {
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
  const handleServerMessage = useCallback((data: any) => {
    switch (data.type) {
      case "GAME_START": {
        gameRef.current = new Chess();
        setFen(gameRef.current.fen());
        clockStartedRef.current = true;
        setCurrentTurn("w");
        currentTurnRef.current = "w";
        setMpConnectionStatus("playing");
        const myTurn = myColorRef.current === "white";
        setStatusMessage(myTurn ? "Your turn — make your move!" : "Opponent's turn");
        speak(myTurn ? "Game started! You play as white. Make your move." : "Game started! You play as black. Wait for opponent.");
        break;
      }

      case "WAITING_FOR_OPPONENT": {
        setMpConnectionStatus("waiting");
        setStatusMessage("Waiting for opponent to connect...");
        break;
      }

      case "MOVE": {
        // Opponent's move — apply it
        const game = gameRef.current;
        try {
          const move = game.move({
            from: data.from,
            to: data.to,
            promotion: data.promotion || "q",
          });
          if (move) {
            setFen(game.fen());
            setMoveHistory((prev) => [...prev, move.san]);
            lastMoveRef.current = move.san;

            const nextTurn = data.turn as "white" | "black";
            const nextTurnChar = nextTurn === "white" ? "w" : "b";
            setCurrentTurn(nextTurnChar);
            currentTurnRef.current = nextTurnChar;

            // Apply increment
            const movedColor = data.player as "white" | "black";
            if (incrementRef.current > 0) {
              if (movedColor === "white") setWhiteTime((p) => p + incrementRef.current);
              else setBlackTime((p) => p + incrementRef.current);
            }

            // Announce opponent's move via voice
            speak(`Opponent plays ${move.san}`);

            if (game.isCheckmate()) {
              const winner = movedColor;
              setGameOver(true);
              gameOverRef.current = true;
              const iWin = winner === myColorRef.current;
              const msg = iWin ? "Checkmate! You win!" : "Checkmate! You lose!";
              setGameResult(msg);
              setStatusMessage("Checkmate!");
              speak(msg);
            } else if (game.isDraw()) {
              setGameOver(true);
              gameOverRef.current = true;
              setGameResult("Draw!");
              setStatusMessage("Game drawn");
              speak("The game is drawn!");
            } else if (game.isCheck()) {
              setStatusMessage("Check! Your turn");
              speak("Check! Make your move.");
              // beep for your turn
              beepService.playTurnBeep().catch(() => {});
            } else if (nextTurn === myColorRef.current) {
              setStatusMessage("Your turn");
              beepService.playTurnBeep().catch(() => {});
            } else {
              setStatusMessage("Opponent's turn");
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
          const msg = `Draw by ${(data.reason || "").toLowerCase()}`;
          setGameResult(msg);
          setWinner(null);
          speak("The game is a draw!");
        } else {
          const iWin =
            (data.winner === "white" && myColorRef.current === "white") ||
            (data.winner === "black" && myColorRef.current === "black");
          const msg = iWin ? "You win!" : "You lose!";
          setGameResult(msg);
          setWinner(iWin ? "You" : "Opponent");
          speak(iWin ? "Congratulations! You win!" : "Game over. You lose.");
        }
        setStatusMessage(data.reason || "Game over");
        break;
      }

      case "DRAW_OFFER": {
        setDrawOfferReceived(true);
        setStatusMessage("Opponent offers a draw");
        speak("Your opponent is offering a draw. Say accept draw or decline draw.");
        break;
      }

      case "DRAW_DECLINED": {
        setStatusMessage("Draw offer declined");
        speak("Draw offer declined.");
        setTimeout(
          () => setStatusMessage(
            currentTurnRef.current === (myColorRef.current === "white" ? "w" : "b")
              ? "Your turn" : "Opponent's turn"
          ), 2000
        );
        break;
      }

      case "OPPONENT_DISCONNECTED": {
        setStatusMessage("Opponent disconnected");
        setMpConnectionStatus("disconnected");
        speak("Your opponent has disconnected.");
        break;
      }
    }
  }, []);

  // ── WebSocket send helper ──────────────────────────────────────────────────
  const sendMessage = (msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  // ---------- Helpers ----------
  function stopVoiceListening() {
    deepgramVoiceCommandService.stopListening();
  }

  function startVoiceListening() {
    deepgramVoiceCommandService.startListening({
      language: "en-IN",
      onListeningStart: () => {
        setIsListening(true);
        beepService.playTurnBeep().catch(() => {});
      },
      onListeningStop: () => setIsListening(false),
      onError: () => setIsListening(false),
      onCommand: handleVoiceCommand,
      onTranscript: (transcript, isFinal) => {
        setLastCommand(transcript);
        if (isFinal) setTimeout(() => setLastCommand(""), 2000);
      },
    });
  }

  async function speak(text: string) {
    if (!text || !text.trim()) return;
    if (!isSoundOnRef.current) return;
    try {
      let spokenText = text;
      // Chess notation pronunciation enhancements
      spokenText = spokenText.replace(/([NBRQK])([a-h][1-8])/g, (_, piece, square) => {
        const names: Record<string, string> = { N: "Knight", B: "Bishop", R: "Rook", Q: "Queen", K: "King" };
        return `${names[piece] || piece} to ${square[0].toUpperCase()} ${square[1]}`;
      });
      spokenText = spokenText.replace(/([NBRQK])x([a-h][1-8])/g, (_, piece, square) => {
        const names: Record<string, string> = { N: "Knight", B: "Bishop", R: "Rook", Q: "Queen", K: "King" };
        return `${names[piece] || piece} takes ${square[0].toUpperCase()} ${square[1]}`;
      });
      spokenText = spokenText.replace(/([a-h])x([a-h][1-8])/g, (_, fromFile, square) =>
        `${fromFile} pawn takes ${square[0].toUpperCase()} ${square[1]}`
      );
      spokenText = spokenText.replace(/O-O-O/gi, "castles queenside");
      spokenText = spokenText.replace(/O-O/gi, "castles kingside");
      spokenText = spokenText.replace(/\s+/g, " ").trim();

      if (deepgramVoiceCommandService.isActive()) deepgramVoiceCommandService.pauseListening();

      await deepgramTTSService.speak({ text: spokenText, rate: 1.0, volume: 0.85 });

      if (!voicePausedRef.current && !gameOverRef.current && voiceInitializedRef.current) {
        deepgramVoiceCommandService.resumeListening();
      }
    } catch (e) {
      console.warn("TTS failed:", e);
    }
  }

  function stopSpeech() { deepgramTTSService.stop(); }

  function handleFlag(flagged: "white" | "black") {
    if (gameOverRef.current) return;
    const winColor = flagged === "white" ? "Black" : "White";
    const message = `Time is up! ${winColor} wins by timeout!`;
    setGameOver(true);
    gameOverRef.current = true;
    setWinner(winColor);
    setStatusMessage(message);
    speak(message);
    if (isMultiplayer) sendMessage({ type: "FLAG" });
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  /**
   * Apply a move — works for both solo and multiplayer
   * source: "board" | "voice" = player's own move
   *         "ai"              = solo AI response
   */
  function applyMove(
    moveInput: string | { from: string; to: string; promotion?: string },
    source: "board" | "voice" | "ai"
  ): boolean {
    if (gameOverRef.current) return false;

    const game = gameRef.current;
    let move: Move | null = null;
    try {
      move = typeof moveInput === "string" ? game.move(moveInput) : game.move(moveInput);
    } catch { move = null; }

    if (!move) {
      if (source === "voice") {
        const legalMoves = game.moves();
        const moveList = legalMoves.slice(0, 5).join(", ");
        speak(`That move is not legal. Try: ${moveList}`);
        setStatusMessage("Illegal move - try again");
      }
      return false;
    }

    setFen(game.fen());
    setMoveHistory((prev) => [...prev, move!.san]);
    lastMoveRef.current = move.san;

    // Solo: record in game recorder
    if (!isMultiplayer && gameRecorderRef.current) {
      gameRecorderRef.current.recordMove(moveInput);
      if (move.color === "w") gameRecorderRef.current.updateTime("black", blackTime);
      else gameRecorderRef.current.updateTime("white", whiteTime);
    }

    if (!clockStartedRef.current) clockStartedRef.current = true;

    const sideToMove = game.turn();

    // Apply increment to the side that just moved
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

    // Voice feedback for the move just made
    if (source === "voice") {
      speak(`You played ${move.san}`);
    } else if (source === "ai") {
      speak(`Computer plays ${move.san}`);
    }

    // Game end checks
    if (game.isCheckmate()) {
      const winColor = sideToMove === "w" ? "Black" : "White";
      const msg = `Checkmate! ${winColor} wins!`;
      setGameOver(true);
      gameOverRef.current = true;
      setWinner(winColor);
      setStatusMessage(msg);
      if (isMultiplayer) {
        const iWin = winColor.toLowerCase() === myColorRef.current;
        setGameResult(iWin ? "You win! by checkmate" : "You lose! by checkmate");
      }
      speak(msg);
    } else if (game.isDraw()) {
      let msg = "The game is drawn";
      if (game.isStalemate()) msg = "Stalemate! The game is drawn";
      else if (game.isThreefoldRepetition()) msg = "Draw by threefold repetition";
      else if (game.isInsufficientMaterial()) msg = "Draw by insufficient material";
      setGameOver(true);
      gameOverRef.current = true;
      setWinner(null);
      setStatusMessage(msg);
      if (isMultiplayer) setGameResult("Draw!");
      speak(msg);
    } else if (game.isCheck()) {
      setStatusMessage("Check!");
      speak("Check!");
    } else {
      if (isMultiplayer) {
        setStatusMessage(
          sideToMove === (myColorRef.current === "white" ? "w" : "b")
            ? "Opponent's turn" : "Your turn"
        );
      } else {
        setStatusMessage(sideToMove === "w" ? "White to move" : "Black to move");
      }
    }

    setCurrentTurn(game.turn());
    currentTurnRef.current = game.turn();

    // Solo: beep + AI response
    if (!isMultiplayer) {
      if (game.turn() === "w" && source === "ai") {
        setTimeout(() => beepService.playTurnBeep().catch(() => {}), 1500);
      }
      if (game.turn() === "b" && source !== "ai" && !gameOverRef.current) {
        setTimeout(() => makeAIMove(), 1000);
      }
    }

    return true;
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
    stopSpeech();
    const newGame = new Chess();
    gameRef.current = newGame;
    setFen(newGame.fen());
    setMoveHistory([]);
    setVoiceHistory([]);
    setStatusMessage("White to move");
    setCurrentTurn("w");
    currentTurnRef.current = "w";
    setGameOver(false);
    setWinner(null);
    gameOverRef.current = false;
    clockStartedRef.current = false;
    lastMoveRef.current = "";
    whiteTimeWarned30.current = false;
    whiteTimeWarned10.current = false;
    blackTimeWarned30.current = false;
    blackTimeWarned10.current = false;
    speak("New game started. You play as white");
  }

  // Solo: save game to DB
  async function saveGameToDB(result: "WIN" | "LOSS" | "DRAW", terminationReason: string) {
    if (!gameRecorderRef.current) return;
    setIsSavingGame(true);
    try {
      const recorder = gameRecorderRef.current;
      const validation = recorder.validateMoves();
      if (!validation.valid) {
        await speak(`Game completed but could not be saved. ${validation.message}`);
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
        gameType: "VOICE" as const,
        terminationReason,
        moveCount: gameStats.moveCount,
        totalTimeWhiteMs: gameStats.whiteTimeUsedMs,
        totalTimeBlackMs: gameStats.blackTimeUsedMs,
        accuracyPercentage: accuracy,
      });
      await speak("Game saved to your database");
    } catch (error) {
      console.error("❌ Failed to save game:", error);
      await speak("Game completed but failed to save");
    } finally {
      setIsSavingGame(false);
    }
  }

  // ── Voice command handler ──────────────────────────────────────────────────
  async function handleVoiceCommand(command: any) {
    const text: string = command.originalText.toLowerCase();
    setLastCommand(command.originalText);
    console.log("🎯 Voice command:", command.intent, "| Text:", text);

    let status: VoiceStatus = "Ignored";

    // Universal controls
    if (command.intent === "VOICE_STOP") {
      stopSpeech();
      beepService.playSuccessBeep().catch(() => {});
      status = "Executed";
    } else if (command.intent === "VOICE_REPEAT") {
      await deepgramTTSService.replay();
      beepService.playSuccessBeep().catch(() => {});
      status = "Executed";
    } else if (command.intent === "VOICE_ON") {
      deepgramVoiceCommandService.setVoiceEnabled(true);
      await speak("Voice commands enabled");
      status = "Executed";
    } else if (command.intent === "VOICE_OFF") {
      deepgramVoiceCommandService.setVoiceEnabled(false);
      await speak("Voice commands disabled");
      status = "Executed";
    }
    // Board controls (solo only)
    else if (!isMultiplayer && (text.includes("flip board") || text.includes("flip the board"))) {
      setBoardOrientation((prev) => (prev === "white" ? "black" : "white"));
      await speak("Board flipped");
      status = "Executed";
    } else if (!isMultiplayer && (text.includes("new game") || text.includes("restart game"))) {
      handleNewGame();
      status = "Executed";
    }
    // Info commands (work in both modes)
    else if (text.includes("what move") || text.includes("last move") || text.includes("what did")) {
      if (lastMoveRef.current) {
        await speak(`The last move was ${lastMoveRef.current}`);
      } else {
        await speak("No moves have been played yet");
      }
      beepService.playSuccessBeep().catch(() => {});
      status = "Executed";
    } else if (text.includes("legal move") || text.includes("what can i") || text.includes("possible move")) {
      const legalMoves = gameRef.current.moves();
      const moveList = legalMoves.slice(0, 6).join(", ");
      const more = legalMoves.length > 6 ? `, and ${legalMoves.length - 6} more` : "";
      await speak(`You can play: ${moveList}${more}`);
      beepService.playSuccessBeep().catch(() => {});
      status = "Executed";
    }
    // Multiplayer-specific: draw and resign by voice
    else if (isMultiplayer && (text.includes("offer draw") || text.includes("propose draw"))) {
      if (!gameOverRef.current) {
        sendMessage({ type: "OFFER_DRAW" });
        setStatusMessage("Draw offer sent...");
        await speak("Draw offer sent to opponent.");
        status = "Executed";
      }
    } else if (isMultiplayer && (text.includes("accept draw") || text.includes("i accept"))) {
      if (drawOfferReceived) {
        sendMessage({ type: "ACCEPT_DRAW" });
        setDrawOfferReceived(false);
        await speak("Draw accepted.");
        status = "Executed";
      }
    } else if (isMultiplayer && (text.includes("decline draw") || text.includes("reject draw"))) {
      if (drawOfferReceived) {
        sendMessage({ type: "DECLINE_DRAW" });
        setDrawOfferReceived(false);
        await speak("Draw declined.");
        status = "Executed";
      }
    } else if (isMultiplayer && text.includes("resign")) {
      if (!gameOverRef.current) {
        sendMessage({ type: "RESIGN" });
        await speak("You have resigned.");
        status = "Executed";
      }
    }
    // Chess move parsing
    else {
      if (gameOverRef.current) {
        await speak(isMultiplayer ? "The game is over." : "The game is over. Say new game to play again.");
        status = "Ignored";
      } else {
        // Check it's the player's turn
        const myTurn = isMultiplayer
          ? gameRef.current.turn() === (myColorRef.current === "white" ? "w" : "b")
          : gameRef.current.turn() === "w";

        if (!myTurn) {
          await speak(isMultiplayer ? "Please wait, it's your opponent's turn." : "Please wait, it's the computer's turn.");
          status = "Error";
        } else {
          const san = GlobalVoiceParser.parseChessMove(text, gameRef.current);
          console.log("🔍 Parsed move:", san);

          if (san) {
            const ok = applyMove(san, "voice");
            if (ok) {
              beepService.playSuccessBeep().catch(() => {});
              status = "Executed";
            } else {
              const legalMoves = gameRef.current.moves();
              await speak(`Invalid move. Try: ${legalMoves.slice(0, 5).join(", ")}`);
              setStatusMessage("Illegal move");
              status = "Error";
            }
          } else {
            const legalMoves = gameRef.current.moves();
            await speak(`I didn't understand that. Try: ${legalMoves.slice(0, 5).join(", ")}`);
            status = "Error";
          }
        }
      }
    }

    setVoiceHistory((prev) => {
      const item: VoiceHistoryItem = { id: Date.now(), text: command.originalText, status, timestamp: Date.now() };
      return [item, ...prev].slice(0, 10);
    });
  }

  // Board drag/drop
  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (gameOverRef.current) return false;
    if (isMultiplayer) {
      const myTurn = gameRef.current.turn() === (myColorRef.current === "white" ? "w" : "b");
      if (!myTurn) return false;
    } else {
      if (gameRef.current.turn() !== "w") return false;
    }
    return applyMove({ from: sourceSquare, to: targetSquare, promotion: "q" }, "board");
  };

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/home");
  };

  // Intro (plays different text for multiplayer vs solo)
  useEffect(() => {
    const playIntro = async () => {
      if (welcomePlayedRef.current || playingIntroRef.current) return;
      playingIntroRef.current = true;
      welcomePlayedRef.current = true;

      try {
        await deepgramVoiceCommandService.initialize();
      } catch (e) {
        console.warn("⚠️ Failed to initialize Deepgram:", e);
      }

      await new Promise((resolve) => setTimeout(resolve, 300));

      if (isMultiplayer) {
        const intro = `Voice Chess Multiplayer! You are playing as ${myColorRef.current}. Use voice commands to make your moves. Say the square name like E4, or piece like Knight to F3. Say legal moves for options.`;
        try {
          await speak(intro);
        } catch (e) {
          console.warn("Intro failed:", e);
        }
      } else {
        try {
          await speak("Welcome to Voice Chess! You are playing as white against the computer.");
          await speak("To move, say the square like E4, or piece like Knight to F3. Say legal moves for options. Ready? Make your first move!");
        } catch (e) {
          console.warn("Intro failed:", e);
        }
      }

      playingIntroRef.current = false;
    };

    playIntro();
  }, []);

  // Clock ticker
  useEffect(() => {
    if (gameOver || isPaused || !clockStartedRef.current) return;
    let timerId: number;
    if (currentTurn === "w") {
      timerId = window.setInterval(() => {
        setWhiteTime((prev) => {
          if (prev === 30 && !whiteTimeWarned30.current) { whiteTimeWarned30.current = true; speak("You have 30 seconds left"); }
          if (prev === 10 && !whiteTimeWarned10.current) { whiteTimeWarned10.current = true; speak("10 seconds remaining!"); }
          if (prev <= 1) { handleFlag("white"); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      timerId = window.setInterval(() => {
        setBlackTime((prev) => {
          if (!isMultiplayer) {
            if (prev === 30 && !blackTimeWarned30.current) { blackTimeWarned30.current = true; speak("Computer has 30 seconds left"); }
            if (prev === 10 && !blackTimeWarned10.current) { blackTimeWarned10.current = true; speak("Computer has 10 seconds!"); }
          } else {
            if (prev === 30 && !blackTimeWarned30.current) { blackTimeWarned30.current = true; speak("Opponent has 30 seconds left"); }
            if (prev === 10 && !blackTimeWarned10.current) { blackTimeWarned10.current = true; speak("Opponent has 10 seconds!"); }
          }
          if (prev <= 1) { handleFlag("black"); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => window.clearInterval(timerId);
  }, [currentTurn, gameOver, isPaused]);

  // Multiplayer: periodic time updates
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
      await saveGameToDB(result, terminationReason);
    };
    const timer = setTimeout(saveGame, 500);
    return () => clearTimeout(timer);
  }, [gameOver]);

  // Voice recognition starts after intro
  useEffect(() => {
    const initVoice = async () => {
      if (voiceInitializedRef.current) return;
      await new Promise((resolve) => setTimeout(resolve, isMultiplayer ? 4000 : 6000));
      voiceInitializedRef.current = true;
      startVoiceListening();
    };
    initVoice();
    return () => {
      stopSpeech();
      stopVoiceListening();
    };
  }, []);

  // ── Derived display values ─────────────────────────────────────────────────
  const opponentName = mpState?.opponentName || "Opponent";
  const opponentPlayer = myColor === "white" ? mpState?.blackPlayer : mpState?.whitePlayer;
  const opponentClock = myColor === "white" ? blackTime : whiteTime;
  const myClock = myColor === "white" ? whiteTime : blackTime;

  return (
    <>
      <Navbar rating={isMultiplayer ? 0 : 1847} streak={isMultiplayer ? 0 : 5} />

      <div className="voice-game-page">
        <div className="voice-back-row">
          <button className="voice-back-btn" onClick={handleBack}>
            ← Back to Menu
          </button>
          {isMultiplayer && (
            <span style={{
              background: mpConnectionStatus === "playing" ? "rgba(0,200,100,0.2)"
                : mpConnectionStatus === "waiting" ? "rgba(255,200,0,0.2)"
                : "rgba(255,80,80,0.2)",
              color: mpConnectionStatus === "playing" ? "#00c864"
                : mpConnectionStatus === "waiting" ? "#ffc800"
                : "#ff5050",
              border: "1px solid currentColor",
              padding: "4px 14px", borderRadius: "20px",
              fontSize: "0.8rem", fontWeight: 600,
            }}>
              {mpConnectionStatus === "playing" ? "● Live"
                : mpConnectionStatus === "waiting" ? "⏳ Waiting"
                : mpConnectionStatus === "connecting" ? "⟳ Connecting"
                : "✕ Disconnected"}
            </span>
          )}
        </div>

        <div className="voice-top-bar">
          <div className="voice-top-left">
            <div className="voice-top-title-row">
              <span className={`voice-dot ${isListening ? "listening" : ""}`} />
              <span className="voice-top-title">
                {isMultiplayer ? "Voice Chess Multiplayer" : "Voice Chess Active"}
              </span>
              <span className="voice-top-badge">
                {isMultiplayer ? `VS ${opponentPlayer || opponentName}` : "AI Opponent"}
              </span>
            </div>
            <div className="voice-top-subtitle">
              {isMultiplayer
                ? <>You are <strong style={{ color: myColor === "white" ? "#fff" : "#aaa" }}>{myColor}</strong> — Say move like: <span className="voice-top-subtitle-strong">"E4"</span> or <span className="voice-top-subtitle-strong">"Knight to F3"</span></>
                : <>Say commands like: <span className="voice-top-subtitle-strong">"Knight to F3"</span> or <span className="voice-top-subtitle-strong">"E4"</span></>
              }
            </div>
          </div>
          <div className="voice-top-right">
            <div className="voice-progress-bar">
              <div className="voice-progress-fill" style={{ width: isListening ? "75%" : "0%" }} />
            </div>
            <button className="voice-top-button" onClick={() => {
              const next = !voicePaused;
              setVoicePaused(next);
              if (next) stopVoiceListening();
              else startVoiceListening();
            }}>
              {voicePaused ? "▶ Resume Voice" : "⏸ Pause Voice"}
            </button>
          </div>
        </div>

        <div className="voice-main-layout">
          {/* LEFT */}
          <div className="voice-left-column">
            {/* Opponent card above board (multiplayer) */}
            {isMultiplayer && (
              <div className={`voice-player-card ${opponentClock <= 30 ? "low-time" : ""}`}
                style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

            <div className="voice-board-card">
              <Chessboard
                {...({
                  position: fen,
                  onPieceDrop: onDrop,
                  boardOrientation: isMultiplayer ? myColor : boardOrientation,
                  boardWidth,
                  arePiecesDraggable: isMultiplayer
                    ? !gameOver && gameRef.current.turn() === (myColor === "white" ? "w" : "b")
                    : !gameOver && gameRef.current.turn() === "w",
                  customBoardStyle: {
                    borderRadius: "16px",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.9)",
                    marginLeft: window.innerWidth > 768 ? "150px" : "0",
                  },
                } as any)}
              />
              <div className="voice-board-footer">
                {!isMultiplayer && (
                  <button className="voice-small-btn" onClick={() =>
                    setBoardOrientation((prev) => prev === "white" ? "black" : "white")}>
                    🔄 Flip Board
                  </button>
                )}
                <button className="voice-small-btn" onClick={() => setIsSoundOn((prev) => !prev)}>
                  {isSoundOn ? "🔊 Sound On" : "🔇 Sound Off"}
                </button>
              </div>
            </div>

            {/* My card below board (multiplayer) */}
            {isMultiplayer && (
              <div className={`voice-player-card you-card ${myClock <= 30 ? "low-time" : ""}`}
                style={{ marginTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

            {/* Multiplayer controls */}
            {isMultiplayer && (
              <div className="voice-board-footer" style={{ marginTop: "8px" }}>
                <button className="voice-small-btn" onClick={() => {
                  if (!gameOverRef.current) { sendMessage({ type: "OFFER_DRAW" }); speak("Draw offer sent."); }
                }} disabled={gameOver}>🤝 Offer Draw</button>
                <button className="voice-small-btn" onClick={() => {
                  if (!gameOverRef.current) { sendMessage({ type: "RESIGN" }); speak("You have resigned."); }
                }} disabled={gameOver} style={{ color: "#ff6b6b" }}>🏳️ Resign</button>
              </div>
            )}

            <div className="voice-command-banner">
              <div className="voice-command-left">
                <span className={`voice-command-icon ${isListening ? "active" : ""}`}>
                  {isListening ? "🎤" : "⏸"}
                </span>
                <div>
                  <div className="voice-command-label">
                    {isListening ? "Listening for Command" : "Voice Paused"}
                  </div>
                  <div className="voice-command-text">
                    {lastCommand ? `"${lastCommand}"` : "Waiting for your voice command..."}
                  </div>
                </div>
              </div>
              <div className={`voice-command-status-pill ${gameOver ? "game-over" : isListening ? "active" : ""}`}>
                {gameOver ? "⏹ Game Over" : isListening ? "● Recording" : "⏸ Idle"}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="voice-right-column">
            {/* Multiplayer draw offer banner */}
            {isMultiplayer && drawOfferReceived && (
              <div style={{
                background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.4)",
                borderRadius: "12px", padding: "16px", marginBottom: "12px", textAlign: "center",
              }}>
                <p style={{ color: "#ffd700", marginBottom: "10px", fontWeight: 600 }}>
                  🤝 Opponent offers a draw
                </p>
                <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                  <button onClick={() => { sendMessage({ type: "ACCEPT_DRAW" }); setDrawOfferReceived(false); }} style={{
                    background: "rgba(0,200,100,0.2)", border: "1px solid #00c864",
                    color: "#00c864", padding: "8px 16px", borderRadius: "8px", cursor: "pointer",
                  }}>✓ Accept</button>
                  <button onClick={() => { sendMessage({ type: "DECLINE_DRAW" }); setDrawOfferReceived(false); }} style={{
                    background: "rgba(255,80,80,0.2)", border: "1px solid #ff5050",
                    color: "#ff5050", padding: "8px 16px", borderRadius: "8px", cursor: "pointer",
                  }}>✗ Decline</button>
                </div>
                <p style={{ color: "#888", fontSize: "0.8rem", marginTop: "8px" }}>Or say "accept draw" / "decline draw"</p>
              </div>
            )}

            {/* Game over banner (multiplayer) */}
            {isMultiplayer && gameOver && gameResult && (
              <div style={{
                background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.3)",
                borderRadius: "16px", padding: "24px", marginBottom: "12px", textAlign: "center",
              }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>
                  {gameResult.includes("win") ? "🏆" : "🤝"}
                </div>
                <div style={{ color: "#ffd700", fontSize: "1.2rem", fontWeight: 700, marginBottom: "16px" }}>
                  {gameResult}
                </div>
                <button onClick={() => navigate("/home")} style={{
                  background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.4)",
                  color: "#ffd700", padding: "10px 24px", borderRadius: "8px",
                  cursor: "pointer", fontSize: "0.95rem", fontWeight: 600,
                }}>Back to Home</button>
              </div>
            )}

            {/* Solo player cards */}
            {!isMultiplayer && (
              <>
                <div className="voice-player-card ai-card">
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
                <div className="voice-player-card you-card">
                  <div className="player-left">
                    <div className="player-avatar you">Y</div>
                    <div>
                      <div className="player-name">You (Voice Player)</div>
                      <div className="player-rating">⭐ Rating: 1847</div>
                    </div>
                  </div>
                  <div className={`player-clock ${whiteTime <= 30 ? "low-time" : ""} ${whiteTime <= 10 ? "critical-time" : ""}`}>
                    {formatTime(whiteTime)}
                  </div>
                </div>
              </>
            )}

            <div className="voice-history-card">
              <div className="panel-header">
                <span>📝 Voice Command History</span>
                <span className="live-pill">● LIVE</span>
              </div>
              <div className="voice-history-list">
                {voiceHistory.length === 0 && (
                  <div className="voice-history-empty">Your voice commands will appear here.</div>
                )}
                {voiceHistory.map((item) => (
                  <div key={item.id} className="voice-history-item">
                    <div className="voice-history-text">"{item.text}"</div>
                    <div className="voice-history-meta">
                      <span className="voice-history-time">Just now</span>
                      <span className={`voice-history-status status-${item.status.toLowerCase()}`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="voice-tips-card">
              <div className="panel-header">
                <span>💡 Voice Command Examples</span>
              </div>
              <ul className="voice-tips-list">
                <li><strong>Simple:</strong> <span className="highlight">"E 4"</span>, <span className="highlight">"D 4"</span></li>
                <li><strong>Piece moves:</strong> <span className="highlight">"Knight to F 3"</span>, <span className="highlight">"Bishop to C 4"</span></li>
                <li><strong>Captures:</strong> <span className="highlight">"Knight takes E 5"</span></li>
                <li><strong>Special:</strong> <span className="highlight">"Castle kingside"</span>, <span className="highlight">"Legal moves"</span></li>
                {isMultiplayer && (
                  <li><strong>Multiplayer:</strong> <span className="highlight">"Offer draw"</span>, <span className="highlight">"Accept draw"</span>, <span className="highlight">"Resign"</span></li>
                )}
              </ul>
            </div>

            <div className="voice-move-history-card">
              <div className="panel-header">
                <span>♟️ Move History</span>
              </div>
              <div className="move-history-list">
                {moveHistory.length === 0 && (
                  <div className="voice-history-empty">Game moves will be recorded here.</div>
                )}
                {Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => (
                  <div key={i} className="move-history-item">
                    <span className="move-index">{i + 1}.</span>
                    <span className="move-text">{moveHistory[i * 2]}</span>
                    {moveHistory[i * 2 + 1] && (
                      <span className="move-text" style={{ marginLeft: "8px" }}>{moveHistory[i * 2 + 1]}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="voice-status-strip">{statusMessage}</div>
          </div>
        </div>
      </div>
    </>
  );
};

export default VoiceGamePage;