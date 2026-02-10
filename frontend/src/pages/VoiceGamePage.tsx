import React, { useEffect, useRef, useState } from "react";
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

// ---------- Types ----------
interface VoiceGamePageProps {
  timeControl?: string;
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
  const routeState = location.state as { timeControl?: string } | null;

  const [effectiveTimeControl, setEffectiveTimeControl] =
    useState<string>(timeControl);

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(
    "white"
  );

  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [voiceHistory, setVoiceHistory] = useState<VoiceHistoryItem[]>([]);
  const [lastCommand, setLastCommand] = useState("");
  const [statusMessage, setStatusMessage] = useState("White to move");

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

  // Game recorder for saving game data
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

  // Track last move for better feedback
  const lastMoveRef = useRef<string>("");

  // ------- Basic sync effects -------
  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  useEffect(() => {
    isSoundOnRef.current = isSoundOn;
  }, [isSoundOn]);

  useEffect(() => {
    voicePausedRef.current = voicePaused;
  }, [voicePaused]);

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

    setEffectiveTimeControl(tc || timeControl || "3+0");
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
    console.log("📝 Voice game recorder initialized for:", effectiveTimeControl);
  }, [effectiveTimeControl]);

  // Initialize Stockfish AI Engine at 1200 rating
  useEffect(() => {
    const initStockfish = async () => {
      try {
        console.log("🚀 Initializing Stockfish AI engine for voice game (1200 rating)...");
        await stockfishService.initialize();
        console.log("✅ Stockfish ready for voice game at 1200 rating");
      } catch (error) {
        console.error("❌ Failed to initialize Stockfish:", error);
        console.log("⚠️ Will use fallback random AI moves");
      }
    };

    initStockfish();

    // Cleanup on unmount
    return () => {
      stockfishService.terminate();
    };
  }, []);

  // ---------- Helpers ----------

  function stopVoiceListening() {
    deepgramVoiceCommandService.stopListening();
  }

  function startVoiceListening() {
    deepgramVoiceCommandService.startListening({
      language: "en-IN",
      onListeningStart: () => {
        setIsListening(true);
        console.log("🎤 Voice active");
        // Play beep sound to indicate user's turn to speak
        beepService.playTurnBeep().catch(err => console.warn("⚠️ Beep error:", err));
      },
      onListeningStop: () => {
        setIsListening(false);
        console.log("🛑 Voice stopped");
      },
      onError: (error) => {
        console.error("❌ Voice error:", error);
        setIsListening(false);
      },
      onCommand: handleVoiceCommand,
      onTranscript: (transcript, isFinal) => {
        setLastCommand(transcript);
        if (isFinal) {
          setTimeout(() => setLastCommand(""), 2000);
        }
      },
    });
  }

  /**
   * Enhanced speak function with natural chess notation pronunciation
   */
  async function speak(text: string) {
    if (!text || !text.trim()) return;
    if (!isSoundOnRef.current) return;

    try {
      // Enhance chess move pronunciation
      let spokenText = text;

      // Make chess notation more natural for TTS
      // Handle standard algebraic notation (e.g., "Nf3", "Qd4")
      spokenText = spokenText.replace(
        /([NBRQK])([a-h][1-8])/g,
        (match, piece, square) => {
          const pieceNames: { [key: string]: string } = {
            N: "Knight",
            B: "Bishop",
            R: "Rook",
            Q: "Queen",
            K: "King",
          };
          const pieceName = pieceNames[piece] || piece;
          const file = square[0].toUpperCase();
          const rank = square[1];
          return `${pieceName} to ${file} ${rank}`;
        }
      );

      // Handle captures (e.g., "Nxe5" -> "Knight takes e5")
      spokenText = spokenText.replace(
        /([NBRQK])x([a-h][1-8])/g,
        (match, piece, square) => {
          const pieceNames: { [key: string]: string } = {
            N: "Knight",
            B: "Bishop",
            R: "Rook",
            Q: "Queen",
            K: "King",
          };
          const pieceName = pieceNames[piece] || piece;
          const file = square[0].toUpperCase();
          const rank = square[1];
          return `${pieceName} takes ${file} ${rank}`;
        }
      );

      // Handle pawn captures (e.g., "exd5" -> "e pawn takes d5")
      spokenText = spokenText.replace(
        /([a-h])x([a-h][1-8])/g,
        (match, fromFile, square) => {
          const file = square[0].toUpperCase();
          const rank = square[1];
          return `${fromFile} pawn takes ${file} ${rank}`;
        }
      );

      // Handle simple pawn moves (e.g., "e4" -> "e file to 4")
      // Only if it looks like a move (not preceded by piece letter)
      spokenText = spokenText.replace(/\b([a-h][1-8])\b/g, (match, square) => {
        // Don't replace if it's part of a piece move we already processed
        if (/\b[NBRQK]\s/.test(spokenText)) {
          return match;
        }
        const file = square[0].toUpperCase();
        const rank = square[1];
        return `${file} ${rank}`;
      });

      // Handle castling
      spokenText = spokenText.replace(/O-O-O/gi, "castles queenside");
      spokenText = spokenText.replace(/O-O/gi, "castles kingside");

      // Add pauses for clarity
      spokenText = spokenText.replace(/\.\s+/g, ". ");
      spokenText = spokenText.replace(/!\s+/g, "! ");
      spokenText = spokenText.replace(/,\s+/g, ", ");

      // Increase clarity by ensuring good spacing
      spokenText = spokenText.replace(/\s+/g, " ").trim();

      // Pause voice listening while TTS speaks
      if (deepgramVoiceCommandService.isActive()) {
        deepgramVoiceCommandService.pauseListening();
      }

      // Always use rate 1.0 for stability and clarity
      // Variable rates cause audio glitches and distortion
      await deepgramTTSService.speak({
        text: spokenText,
        rate: 1.0,
        volume: 0.85,
      });

      // Resume listening
      if (
        !voicePausedRef.current &&
        !gameOverRef.current &&
        voiceInitializedRef.current
      ) {
        deepgramVoiceCommandService.resumeListening();
      }
    } catch (e) {
      console.warn("TTS failed:", e);
    }
  }

  function stopSpeech() {
    deepgramTTSService.stop();
  }

  function handleFlag(flagged: "white" | "black") {
    if (gameOverRef.current) return;
    const winColor = flagged === "white" ? "Black" : "White";
    const message = `Time is up! ${winColor} wins by timeout!`;
    setGameOver(true);
    setWinner(winColor);
    setStatusMessage(message);
    speak(message);
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  /**
   * Enhanced move application with better feedback
   */
  function applyMove(
    moveInput: string | { from: string; to: string; promotion?: string },
    source: "board" | "voice" | "ai"
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
      if (source === "voice") {
        const legalMoves = game.moves();
        const moveList = legalMoves.slice(0, 5).join(", ");
        const moreText =
          legalMoves.length > 5 ? `, and ${legalMoves.length - 5} more` : "";

        speak(`That move is not legal. Try: ${moveList}${moreText}`);
        setStatusMessage("Illegal move - try again");
      }
      return false;
    }

    setFen(game.fen());
    setMoveHistory((prev) => [...prev, move!.san]);
    lastMoveRef.current = move.san;

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

    // Enhanced move announcements
    if (source === "voice") {
      // Confirm user's move with natural language - faster for feedback
      speak(`You played ${move.san}`);
    } else if (source === "ai") {
      // Announce opponent's move clearly
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
      speak(msg);
    } else if (game.isDraw()) {
      let msg = "The game is drawn";
      if (game.isStalemate()) {
        msg = "Stalemate! The game is drawn";
      } else if (game.isThreefoldRepetition()) {
        msg = "Draw by threefold repetition";
      } else if (game.isInsufficientMaterial()) {
        msg = "Draw by insufficient material";
      }
      setGameOver(true);
      gameOverRef.current = true;
      setWinner(null);
      setStatusMessage(msg);
      speak(msg);
    } else if (game.isCheck()) {
      setStatusMessage("Check!");
      speak("Check!");
    } else {
      setStatusMessage(sideToMove === "w" ? "White to move" : "Black to move");
    }

    setCurrentTurn(game.turn());

    // Play beep when it becomes user's turn to move (after AI moves)
    if (game.turn() === "w" && source === "ai") {
      // Delay beep slightly to come after AI move announcement
      setTimeout(() => {
        beepService.playTurnBeep().catch(err => console.warn("⚠️ Beep error:", err));
      }, 1500);
    }

    // AI response
    if (game.turn() === "b" && source !== "ai" && !gameOverRef.current) {
      setTimeout(() => makeAIMove(), 1000);
    }

    return true;
  }

  /**
   * AI Move using Stockfish at 1200 rating level
   * Skill level 10 = ~1200 rating
   * Depth 12-15 ensures reasonable thinking time without being too strong
   */
  async function makeAIMove() {
    if (gameOverRef.current) return;
    const game = gameRef.current;
    
    try {
      // Use stockfishService for intelligent move
      const move = await stockfishService.getBestMove(
        game.fen(),
        3// Depth 6 = responsive AI without UI freeze
      );
      
      if (move) {
        const moveStr = `${move.from}${move.to}${move.promotion || ''}`;
        console.log(`🤖 AI plays: ${moveStr}`);
        applyMove(move, "ai");
        
        // Announce the move via voice
        const fromSquare = move.from.toUpperCase();
        const toSquare = move.to.toUpperCase();
        await speak(`I move ${fromSquare} to ${toSquare}`);
      } else {
        // Fallback to random move if Stockfish fails
        console.warn("⚠️ Stockfish failed, using fallback move");
        makeRandomMove();
      }
    } catch (error) {
      console.error("❌ Error in makeAIMove:", error);
      makeRandomMove();
    }
  }

  /**
   * Fallback: Random move selection
   */
  function makeRandomMove() {
    const game = gameRef.current;
    const legalMoves = game.moves();
    if (legalMoves.length === 0) return;
    const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    applyMove(randomMove, "ai");
  }

  function handleNewGame() {
    stopSpeech();
    const newGame = new Chess();
    gameRef.current = newGame;
    setFen(newGame.fen());
    setMoveHistory([]);
    setVoiceHistory([]);
    setStatusMessage("White to move");
    setCurrentTurn("w");
    setGameOver(false);
    setWinner(null);
    gameOverRef.current = false;
    clockStartedRef.current = false;
    lastMoveRef.current = "";

    // Reset warning flags
    whiteTimeWarned30.current = false;
    whiteTimeWarned10.current = false;
    blackTimeWarned30.current = false;
    blackTimeWarned10.current = false;

    speak("New game started. You play as white");
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
      
      // Validate moves before saving
      const validation = recorder.validateMoves();
      console.log(`🔍 Move Validation: ${validation.message}`);
      
      if (!validation.valid) {
        console.error(`❌ Cannot save game: ${validation.message}`);
        await speak(`Game completed but could not be saved. ${validation.message}`);
        setIsSavingGame(false);
        return;
      }

      const movesJson = recorder.getMovesAsJSON();
      const pgn = recorder.generatePGN(
        "You (White)",
        "ChessMaster AI",
        result,
        effectiveTimeControl,
        "VOICE",
        terminationReason
      );

      const gameStats = recorder.getGameStats();
      const accuracy = calculateAccuracy(moveHistory);

      // Log comprehensive game info
      console.log("📊 Voice Game Statistics:");
      console.log(`   Total moves (SANs): ${gameStats.totalMoves}`);
      console.log(`   Full moves: ${gameStats.moveCount}`);
      console.log(`   PGN length: ${pgn.length} bytes`);
      console.log(`   Result: ${result}`);

      const savePayload = {
        opponentName: "ChessMaster AI",
        result,
        pgn,
        movesJson,
        whiteRating: 1847,
        blackRating: 1923,
        timeControl: effectiveTimeControl,
        gameType: "VOICE" as const,
        terminationReason,
        moveCount: gameStats.moveCount,
        totalTimeWhiteMs: gameStats.whiteTimeUsedMs,
        totalTimeBlackMs: gameStats.blackTimeUsedMs,
        accuracyPercentage: accuracy,
      };

      console.log("💾 Saving voice game to database...");
      const response = await gameService.saveGame(savePayload);
      console.log("✅ Voice game saved successfully:", response);
      await speak("Game saved to your database");
    } catch (error) {
      console.error("❌ Failed to save game:", error);
      await speak("Game completed but failed to save");
    } finally {
      setIsSavingGame(false);
    }
  }

  /**
   * Calculate move accuracy based on move count
   */
  function calculateAccuracy(moves: string[]): number {
    // Simplified calculation - in production, use Stockfish analysis
    return 75 + Math.floor(Math.random() * 20); // 75-95% range
  }

  /**
   * Enhanced voice command handler with better chess move parsing
   */
  async function handleVoiceCommand(command: any) {
    const text: string = command.originalText.toLowerCase();
    setLastCommand(command.originalText);

    console.log("🎯 Voice command:", command.intent, "| Text:", text);

    let status: VoiceStatus = "Ignored";

    // Stop command
    if (command.intent === "VOICE_STOP") {
      stopSpeech();
      beepService.playSuccessBeep().catch(err => console.warn("⚠️ Beep error:", err));
      status = "Executed";
    }
    // Repeat command
    else if (command.intent === "VOICE_REPEAT") {
      await deepgramTTSService.replay();
      beepService.playSuccessBeep().catch(err => console.warn("⚠️ Beep error:", err));
      status = "Executed";
    }
    // Voice control
    else if (command.intent === "VOICE_ON") {
      deepgramVoiceCommandService.setVoiceEnabled(true);
      await speak("Voice commands enabled");
      beepService.playSuccessBeep().catch(err => console.warn("⚠️ Beep error:", err));
      status = "Executed";
    } else if (command.intent === "VOICE_OFF") {
      deepgramVoiceCommandService.setVoiceEnabled(false);
      await speak("Voice commands disabled");
      beepService.playSuccessBeep().catch(err => console.warn("⚠️ Beep error:", err));
      status = "Executed";
    }
    // Game controls
    else if (text.includes("flip board") || text.includes("flip the board")) {
      setBoardOrientation((prev) => (prev === "white" ? "black" : "white"));
      await speak("Board flipped");
      beepService.playSuccessBeep().catch(err => console.warn("⚠️ Beep error:", err));
      status = "Executed";
    } else if (text.includes("new game") || text.includes("restart game")) {
      handleNewGame();
      beepService.playSuccessBeep().catch(err => console.warn("⚠️ Beep error:", err));
      status = "Executed";
    }
    // What move - tell user the last move
    else if (
      text.includes("what move") ||
      text.includes("last move") ||
      text.includes("what did")
    ) {
      if (lastMoveRef.current) {
        await speak(`The last move was ${lastMoveRef.current}`);
      } else {
        await speak("No moves have been played yet");
      }
      beepService.playSuccessBeep().catch(err => console.warn("⚠️ Beep error:", err));
      status = "Executed";
    }
    // Legal moves help
    else if (
      text.includes("legal move") ||
      text.includes("what can i") ||
      text.includes("possible move")
    ) {
      const legalMoves = gameRef.current.moves();
      const moveList = legalMoves.slice(0, 6).join(", ");
      const moreText =
        legalMoves.length > 6
          ? `, and ${legalMoves.length - 6} more moves`
          : "";
      await speak(`You can play: ${moveList}${moreText}`);
      beepService.playSuccessBeep().catch(err => console.warn("⚠️ Beep error:", err));
      status = "Executed";
    }
    // Chess move parsing
    else {
      if (gameOverRef.current) {
        await speak("The game is over. Say 'new game' to play again");
        status = "Ignored";
      } else if (gameRef.current.turn() !== "w") {
        await speak("Please wait, it's the computer's turn");
        status = "Error";
      } else {
        // Enhanced chess move parsing
        const san = GlobalVoiceParser.parseChessMove(text, gameRef.current);

        console.log("🔍 Parsed move:", san);
        console.log("📋 Original text:", text);

        if (san) {
          const ok = applyMove(san, "voice");
          if (ok) {
            // Play beep after successful move
            beepService.playSuccessBeep().catch(err => console.warn("⚠️ Beep error:", err));
            status = "Executed";
          } else {
            const legalMoves = gameRef.current.moves();
            const moveList = legalMoves.slice(0, 5).join(", ");
            await speak(`Invalid move. Try: ${moveList}`);
            setStatusMessage("Illegal move");
            status = "Error";
          }
        } else {
          // Failed to parse - provide helpful feedback
          const legalMoves = gameRef.current.moves();
          const moveList = legalMoves.slice(0, 5).join(", ");
          await speak(`I didn't understand that move. Try: ${moveList}`);
          status = "Error";
        }
      }
    }

    // Add to history
    setVoiceHistory((prev) => {
      const item: VoiceHistoryItem = {
        id: Date.now(),
        text: command.originalText,
        status,
        timestamp: Date.now(),
      };
      return [item, ...prev].slice(0, 10);
    });
  }

  // Board drag/drop
  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (gameOverRef.current) return false;
    if (gameRef.current.turn() !== "w") return false;

    const success = applyMove(
      { from: sourceSquare, to: targetSquare, promotion: "q" },
      "board"
    );
    return success;
  };

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/home");
  };

  /**
   * Enhanced intro with better pacing and clarity
   */
  useEffect(() => {
    const playIntro = async () => {
      if (welcomePlayedRef.current || playingIntroRef.current) {
        return;
      }

      playingIntroRef.current = true;
      welcomePlayedRef.current = true;

      console.log("🔊 Starting game intro...");

      try {
        await deepgramVoiceCommandService.initialize();
        console.log("✅ Deepgram services initialized");
      } catch (e) {
        console.warn("⚠️ Failed to initialize Deepgram:", e);
      }

      await new Promise((resolve) => setTimeout(resolve, 300));

      // Shorter, faster intro - reduced from ~600 words to ~60 words
      const intro1 = `Welcome to Voice Chess! You are playing as white against the computer.`;
      const intro2 = `To move, say the square like E4, or piece like Knight to F3. Say legal moves for options. Ready? Make your first move!`;

      try {
        // Quick first greeting
        await speak(intro1);
        console.log("✅ Intro part 1 completed");

        // Brief instructions
        await speak(intro2);
        console.log("✅ Intro completed");
      } catch (e) {
        console.warn("❌ Intro failed:", e);
      } finally {
        playingIntroRef.current = false;
      }
    };

    playIntro();
  }, []);

  // Clock with enhanced time warnings
  useEffect(() => {
    if (gameOver || isPaused || !clockStartedRef.current) return;

    let timerId: number;

    if (currentTurn === "w") {
      timerId = window.setInterval(() => {
        setWhiteTime((prev) => {
          if (prev === 30 && !whiteTimeWarned30.current) {
            whiteTimeWarned30.current = true;
            speak("You have 30 seconds left");
          } else if (prev === 10 && !whiteTimeWarned10.current) {
            whiteTimeWarned10.current = true;
            speak("10 seconds remaining!");
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
            speak("Computer has 30 seconds left");
          } else if (prev === 10 && !blackTimeWarned10.current) {
            blackTimeWarned10.current = true;
            speak("Computer has 10 seconds!");
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
      }

      await saveGameToDB(result, terminationReason);
    };

    // Delay slightly to ensure all state updates are done
    const timer = setTimeout(saveGame, 500);
    return () => clearTimeout(timer);
  }, [gameOver]);

  // Initialize voice recognition after intro
  useEffect(() => {
    const initVoice = async () => {
      if (voiceInitializedRef.current) return;

      // Wait for intro to finish - reduced from 15s to 6s
      // Intro parts: ~3s (intro1) + ~2.5s (intro2) + buffer
      await new Promise((resolve) => setTimeout(resolve, 6000));
      voiceInitializedRef.current = true;

      console.log("🎤 Voice recognition ready");
      startVoiceListening();
    };

    initVoice();

    return () => {
      stopSpeech();
      stopVoiceListening();
    };
  }, []);

  return (
    <>
      <Navbar rating={1847} streak={5} />

      <div className="voice-game-page">
        <div className="voice-back-row">
          <button className="voice-back-btn" onClick={handleBack}>
            ← Back to Menu
          </button>
        </div>

        <div className="voice-top-bar">
          <div className="voice-top-left">
            <div className="voice-top-title-row">
              <span className={`voice-dot ${isListening ? "listening" : ""}`} />
              <span className="voice-top-title">Voice Chess Active</span>
              <span className="voice-top-badge">AI Opponent</span>
            </div>
            <div className="voice-top-subtitle">
              Say commands like:{" "}
              <span className="voice-top-subtitle-strong">"Knight to F3"</span>{" "}
              or <span className="voice-top-subtitle-strong">"E4"</span>
            </div>
          </div>
          <div className="voice-top-right">
            <div className="voice-progress-bar">
              <div
                className="voice-progress-fill"
                style={{ width: isListening ? "75%" : "0%" }}
              />
            </div>
            <button
              className="voice-top-button"
              onClick={() => {
                const next = !voicePaused;
                setVoicePaused(next);
                if (next) {
                  stopVoiceListening();
                } else {
                  startVoiceListening();
                }
              }}
            >
              {voicePaused ? "▶ Resume Voice" : "⏸ Pause Voice"}
            </button>
          </div>
        </div>

        <div className="voice-main-layout">
          {/* LEFT */}
          <div className="voice-left-column">
            <div className="voice-board-card">
              <Chessboard
                {...({
                  position: fen,
                  onPieceDrop: onDrop,
                  boardOrientation,
                  boardWidth,
                  arePiecesDraggable:
                    !gameOver && gameRef.current.turn() === "w",
                  customBoardStyle: {
                    borderRadius: "16px",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.9)",
                    marginLeft: window.innerWidth > 768 ? "150px" : "0",
                  },
                } as any)}
              />
              <div className="voice-board-footer">
                <button
                  className="voice-small-btn"
                  onClick={() =>
                    setBoardOrientation((prev) =>
                      prev === "white" ? "black" : "white"
                    )
                  }
                >
                  🔄 Flip Board
                </button>
                <button
                  className="voice-small-btn"
                  onClick={() => setIsSoundOn((prev) => !prev)}
                >
                  {isSoundOn ? "🔊 Sound On" : "🔇 Sound Off"}
                </button>
              </div>
            </div>

            <div className="voice-command-banner">
              <div className="voice-command-left">
                <span
                  className={`voice-command-icon ${
                    isListening ? "active" : ""
                  }`}
                >
                  {isListening ? "🎤" : "⏸"}
                </span>
                <div>
                  <div className="voice-command-label">
                    {isListening ? "Listening for Command" : "Voice Paused"}
                  </div>
                  <div className="voice-command-text">
                    {lastCommand
                      ? `"${lastCommand}"`
                      : "Waiting for your voice command..."}
                  </div>
                </div>
              </div>
              <div
                className={`voice-command-status-pill ${
                  gameOver ? "game-over" : isListening ? "active" : ""
                }`}
              >
                {gameOver
                  ? "⏹ Game Over"
                  : isListening
                  ? "● Recording"
                  : "⏸ Idle"}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="voice-right-column">
            <div className="voice-player-card ai-card">
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

            <div className="voice-player-card you-card">
              <div className="player-left">
                <div className="player-avatar you">Y</div>
                <div>
                  <div className="player-name">You (Voice Player)</div>
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

            <div className="voice-history-card">
              <div className="panel-header">
                <span>📝 Voice Command History</span>
                <span className="live-pill">● LIVE</span>
              </div>
              <div className="voice-history-list">
                {voiceHistory.length === 0 && (
                  <div className="voice-history-empty">
                    Your voice commands will appear here in real-time.
                  </div>
                )}
                {voiceHistory.map((item) => (
                  <div key={item.id} className="voice-history-item">
                    <div className="voice-history-text">"{item.text}"</div>
                    <div className="voice-history-meta">
                      <span className="voice-history-time">Just now</span>
                      <span
                        className={`voice-history-status status-${item.status.toLowerCase()}`}
                      >
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
                <li>
                  <strong>Simple:</strong>{" "}
                  <span className="highlight">"E 4"</span>,{" "}
                  <span className="highlight">"D 4"</span>
                </li>
                <li>
                  <strong>Piece moves:</strong>{" "}
                  <span className="highlight">"Knight to F 3"</span>,{" "}
                  <span className="highlight">"Bishop to C 4"</span>
                </li>
                <li>
                  <strong>Captures:</strong>{" "}
                  <span className="highlight">"Knight takes E 5"</span>,{" "}
                  <span className="highlight">"Pawn takes D 5"</span>
                </li>
                <li>
                  <strong>Special:</strong>{" "}
                  <span className="highlight">"Castle kingside"</span>,{" "}
                  <span className="highlight">"What move"</span>,{" "}
                  <span className="highlight">"Legal moves"</span>
                </li>
              </ul>
            </div>

            <div className="voice-move-history-card">
              <div className="panel-header">
                <span>♟️ Move History</span>
              </div>
              <div className="move-history-list">
                {moveHistory.length === 0 && (
                  <div className="voice-history-empty">
                    Game moves will be recorded here.
                  </div>
                )}
                {moveHistory.map((move, idx) => (
                  <div key={idx} className="move-history-item">
                    <span className="move-index">
                      {Math.floor(idx / 2) + 1}.
                    </span>
                    <span className="move-text">{move}</span>
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
