// useVoiceChess.ts
// Auto-mic voice chess hook: mic auto-starts on user's turn, stays open until valid move,
// speaks illegal move feedback and suggestions, handles unclear speech.

import { useEffect, useRef, useCallback, useState } from "react";
import { Chess } from "chess.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoiceChessConfig {
  gameRef: React.MutableRefObject<Chess>;
  isMyTurn: () => boolean;
  isGameOver: () => boolean;
  isMultiplayer: boolean;
  gameStarted: boolean;
  onMove: (from: string, to: string, promotion?: string) => boolean;
  playerColor: "white" | "black";
}

export interface VoiceChessState {
  isListening: boolean;
  transcript: string;
  status: "idle" | "listening" | "processing" | "error" | "speaking";
  errorMessage: string | null;
  lastSpoken: string;
  supported: boolean;
}

// ─── TTS helper ───────────────────────────────────────────────────────────────

let ttsQueue: string[] = [];
let ttsSpeaking = false;

function speak(text: string, onDone?: () => void) {
  if (!window.speechSynthesis) {
    onDone?.();
    return;
  }
  ttsQueue.push(text);
  if (!ttsSpeaking) drainTTS(onDone);
}

function drainTTS(onDone?: () => void) {
  if (ttsQueue.length === 0) {
    ttsSpeaking = false;
    onDone?.();
    return;
  }
  ttsSpeaking = true;
  const text = ttsQueue.shift()!;
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 1.05;
  utt.pitch = 1;
  // Prefer a natural-sounding English voice
  const voices = window.speechSynthesis.getVoices();
  const best = voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("natural"))
    || voices.find(v => v.lang.startsWith("en-US"))
    || voices.find(v => v.lang.startsWith("en"));
  if (best) utt.voice = best;
  utt.onend = () => drainTTS(onDone);
  utt.onerror = () => drainTTS(onDone);
  window.speechSynthesis.speak(utt);
}

function stopSpeaking() {
  ttsQueue = [];
  ttsSpeaking = false;
  window.speechSynthesis?.cancel();
}

// ─── Move suggestions ─────────────────────────────────────────────────────────

function getSuggestions(game: Chess): string {
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return "";
  // Pick 3 interesting moves: prioritize checks, captures, then random
  const checks = moves.filter(m => m.san.includes("+"));
  const captures = moves.filter(m => m.san.includes("x"));
  const pool = [...checks.slice(0, 1), ...captures.slice(0, 1), ...moves.slice(0, 3)];
  const unique = [...new Map(pool.map(m => [m.san, m])).values()].slice(0, 3);
  const names = unique.map(m => sanToWords(m.san));
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names[0]}, ${names[1]}, or ${names[2]}`;
}

// Convert SAN like "Nf3", "exd5", "O-O" into speakable words
function sanToWords(san: string): string {
  san = san.replace(/[+#!?]/g, "");
  if (san === "O-O-O") return "queen side castle";
  if (san === "O-O") return "king side castle";

  const pieceNames: Record<string, string> = {
    N: "knight", B: "bishop", R: "rook", Q: "queen", K: "king",
  };

  let s = san;
  // Piece moves: Nf3 → knight f 3
  const pieceMatch = s.match(/^([NBRQK])([a-h]?[1-8]?)x?([a-h][1-8])(=[NBRQK])?$/);
  if (pieceMatch) {
    const piece = pieceNames[pieceMatch[1]] || pieceMatch[1];
    const to = squareToWords(pieceMatch[3]);
    const promo = pieceMatch[4] ? " promotes to " + pieceNames[pieceMatch[4][1]] : "";
    return `${piece} to ${to}${promo}`;
  }

  // Pawn captures: exd5
  const pawnCap = s.match(/^([a-h])x([a-h][1-8])(=[NBRQK])?$/);
  if (pawnCap) {
    return `${pawnCap[1]} takes ${squareToWords(pawnCap[2])}`;
  }

  // Pawn moves: e4
  const pawnMove = s.match(/^([a-h][1-8])(=[NBRQK])?$/);
  if (pawnMove) {
    return `pawn to ${squareToWords(pawnMove[1])}`;
  }

  return s;
}

function squareToWords(sq: string): string {
  const ranks: Record<string, string> = {
    "1": "one", "2": "two", "3": "three", "4": "four",
    "5": "five", "6": "six", "7": "seven", "8": "eight",
  };
  return `${sq[0]} ${ranks[sq[1]] || sq[1]}`;
}

// ─── Voice move parser ────────────────────────────────────────────────────────

const FILE_MAP: Record<string, string> = {
  a: "a", ay: "a", eh: "a", alpha: "a",
  b: "b", be: "b", bee: "b", bravo: "b",
  c: "c", see: "c", sea: "c", charlie: "c", si: "c",
  d: "d", de: "d", dee: "d", delta: "d",
  e: "e", ee: "e", echo: "e",
  f: "f", ef: "f", eff: "f", foxtrot: "f",
  g: "g", ge: "g", gee: "g", golf: "g", ji: "g",
  h: "h", aitch: "h", ache: "h", hotel: "h", haitch: "h",
};

const RANK_MAP: Record<string, string> = {
  one: "1", won: "1", wan: "1", wun: "1", "1": "1",
  two: "2", too: "2", tu: "2", "2": "2",
  three: "3", tree: "3", "3": "3",
  four: "4", for: "4", fore: "4", "4": "4",
  five: "5", fibe: "5", "5": "5",
  six: "6", sicks: "6", "6": "6",
  seven: "7", seben: "7", "7": "7",
  eight: "8", ate: "8", ait: "8", "8": "8",
};

const PIECE_MAP: Record<string, string> = {
  knight: "n", night: "n", nite: "n", naight: "n", nait: "n", knite: "n",
  bishop: "b", bisop: "b", bish: "b",
  rook: "r", rock: "r", ruk: "r", castle: "r",
  queen: "q", kween: "q", quin: "q",
  king: "k", kink: "k",
  pawn: "p", pond: "p",
};

export function parseVoiceMove(
  transcript: string,
  game: Chess
): { from: string; to: string; promotion?: string } | null {
  const legalMoves = game.moves({ verbose: true });
  if (!legalMoves.length) return null;

  let t = transcript.toLowerCase().trim();

  // Pre-process phonetic substitutions
  t = t
    .replace(/\balpha\b/g, "a").replace(/\bbravo\b/g, "b").replace(/\bcharlie\b/g, "c")
    .replace(/\bdelta\b/g, "d").replace(/\becho\b/g, "e").replace(/\bfoxtrot\b/g, "f")
    .replace(/\bgolf\b/g, "g").replace(/\bhotel\b/g, "h")
    .replace(/\bto\b|\btoo\b|\btwo\b|\btu\b/g, " ")
    .replace(/\b(takes?|captures?|x)\b/g, " ")
    .replace(/\b(move?s?|goes?|puts?|plays?)\b/g, " ")
    .replace(/\s+/g, " ").trim();

  // ── 1. Try direct SAN match (handles Nf3, e4, O-O, etc.) ─────────────────
  const sanVariants = [t, t.replace(/\s/g, "")];
  for (const variant of sanVariants) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = game.move(variant, { sloppy: true } as any);
      if (m) { game.undo(); return { from: m.from, to: m.to, promotion: m.promotion }; }
    } catch { /* not SAN */ }
  }

  // ── 2. Castling ─────────────────────────────────────────────────────────
  if (/castle|castling|rochade/.test(t)) {
    const kingside = legalMoves.find(m => m.san === "O-O");
    const queenside = legalMoves.find(m => m.san === "O-O-O");
    if (/queen/.test(t) && queenside) return { from: queenside.from, to: queenside.to };
    if (/king|short/.test(t) && kingside) return { from: kingside.from, to: kingside.to };
    if (kingside) return { from: kingside.from, to: kingside.to };
    if (queenside) return { from: queenside.from, to: queenside.to };
  }

  // ── 3. Resolve file/rank tokens ──────────────────────────────────────────
  const resolveFile = (w: string) => FILE_MAP[w] || (/^[a-h]$/.test(w) ? w : null);
  const resolveRank = (w: string) => RANK_MAP[w] || (/^[1-8]$/.test(w) ? w : null);

  // Helper: extract all [file][rank] squares from text
  const extractSquares = (text: string): string[] => {
    const squares: string[] = [];
    // Explicit squares like "e4", "g1"
    const direct = [...text.matchAll(/\b([a-h])([1-8])\b/gi)];
    for (const m of direct) squares.push(m[1] + m[2]);

    // Word-based: "e four", "g one"
    const words = text.split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      const f = resolveFile(words[i]);
      const r = resolveRank(words[i + 1]);
      if (f && r) squares.push(f + r);
    }
    return [...new Set(squares)];
  };

  const squares = extractSquares(t);

  // ── 4. Two-square move (from → to) ───────────────────────────────────────
  if (squares.length >= 2) {
    const [from, to] = squares;
    const candidate = legalMoves.find(m => m.from === from && m.to === to);
    if (candidate) return { from, to, promotion: candidate.promotion || (needsPromo(to) ? "q" : undefined) };
  }

  // ── 5. Piece + destination square ────────────────────────────────────────
  const words = t.split(/\s+/);
  let detectedPiece: string | null = null;
  for (const w of words) {
    if (PIECE_MAP[w]) { detectedPiece = PIECE_MAP[w]; break; }
  }

  if (detectedPiece && squares.length >= 1) {
    const toSq = squares[squares.length - 1];
    const candidates = legalMoves.filter(m => m.to === toSq && m.piece === detectedPiece);
    if (candidates.length === 1) return { from: candidates[0].from, to: toSq, promotion: candidates[0].promotion };
    if (candidates.length > 1) {
      // Disambiguation: check if a from-square was also mentioned
      if (squares.length >= 2) {
        const fromSq = squares[0];
        const specific = candidates.find(m => m.from === fromSq);
        if (specific) return { from: specific.from, to: toSq };
      }
      return { from: candidates[0].from, to: toSq }; // default: first candidate
    }
  }

  // ── 6. Single destination square — try any legal move there ──────────────
  if (squares.length === 1) {
    const toSq = squares[0];
    const candidates = legalMoves.filter(m => m.to === toSq);
    if (candidates.length === 1) return { from: candidates[0].from, to: toSq, promotion: candidates[0].promotion };
    // Pawn preference
    const pawns = candidates.filter(m => m.piece === "p");
    if (pawns.length === 1) return { from: pawns[0].from, to: toSq };
  }

  return null;
}

function needsPromo(to: string): boolean {
  return to[1] === "1" || to[1] === "8";
}

// ─── Main Hook ────────────────────────────────────────────────────────────────

const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export function useVoiceChess(config: VoiceChessConfig): VoiceChessState & {
  stopListening: () => void;
  manualListen: () => void;
} {
  const {
    gameRef, isMyTurn, isGameOver, isMultiplayer, gameStarted, onMove, playerColor,
  } = config;

  const [state, setState] = useState<VoiceChessState>({
    isListening: false,
    transcript: "",
    status: "idle",
    errorMessage: null,
    lastSpoken: "",
    supported: !!SR,
  });

  const recognitionRef = useRef<any>(null);
  const activeRef = useRef(false);         // is the hook supposed to be running?
  const speakingRef = useRef(false);       // TTS in progress
  const stateRef = useRef(state);
  stateRef.current = state;

  const setPartial = useCallback((patch: Partial<VoiceChessState>) => {
    setState(prev => ({ ...prev, ...patch }));
  }, []);

  // ── speak with state tracking ─────────────────────────────────────────────
  const sayMessage = useCallback((text: string, onDone?: () => void) => {
    speakingRef.current = true;
    setPartial({ status: "speaking", lastSpoken: text, errorMessage: null });
    stopSpeaking();
    speak(text, () => {
      speakingRef.current = false;
      setPartial({ status: "idle" });
      onDone?.();
    });
  }, [setPartial]);

  // ── Core recognition start ────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!SR) return;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }

    const r = new SR();
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 5;
    recognitionRef.current = r;

    r.onstart = () => {
      setPartial({ isListening: true, status: "listening", transcript: "", errorMessage: null });
    };

    r.onresult = (event: any) => {
      const results = Array.from(event.results[0]) as any[];
      const transcripts: string[] = results.map((r: any) => String(r.transcript));
      const isFinal = event.results[0].isFinal;

      setPartial({ transcript: transcripts[0] });

      if (!isFinal) return;

      setPartial({ status: "processing" });

      // Guard: only process if it's still our turn
      if (!isMyTurn() || isGameOver() || speakingRef.current) {
        setPartial({ status: "idle", isListening: false });
        return;
      }

      // Try each alternative transcript
      let moved = false;
      let parsedMove: ReturnType<typeof parseVoiceMove> = null;

      for (const transcript of transcripts) {
        parsedMove = parseVoiceMove(transcript, gameRef.current);
        if (parsedMove) break;
      }

      if (parsedMove) {
        // Attempt the move
        const success = onMove(parsedMove.from, parsedMove.to, parsedMove.promotion);
        if (success) {
          moved = true;
          setPartial({ status: "idle", isListening: false, errorMessage: null });
          activeRef.current = false; // Turn over, stop auto-listen
          return;
        } else {
          // Parsed but illegal (shouldn't normally happen, but handle gracefully)
          const suggestions = getSuggestions(gameRef.current);
          const msg = suggestions
            ? `That move is not allowed. Try ${suggestions}.`
            : "That move is not allowed. Please try another move.";
          sayMessage(msg, () => {
            if (activeRef.current && isMyTurn() && !isGameOver()) startListening();
          });
          return;
        }
      }

      // Nothing matched — check if it sounded like a chess attempt at all
      const raw = transcripts[0];
      const looksLikeChess = /\b[a-h]\b|\bknight|bishop|rook|queen|king|castle|pawn\b/i.test(raw);

      if (!raw.trim() || raw.trim().length < 2) {
        // Nothing heard
        sayMessage("I didn't catch that. Please say your move clearly.", () => {
          if (activeRef.current && isMyTurn() && !isGameOver()) startListening();
        });
      } else if (looksLikeChess) {
        // Heard something chess-like but couldn't parse it — suggest moves
        const suggestions = getSuggestions(gameRef.current);
        const msg = suggestions
          ? `I didn't understand that move. You could try ${suggestions}.`
          : `I didn't understand that move. Please say a square like E four, or a piece name like knight F three.`;
        sayMessage(msg, () => {
          if (activeRef.current && isMyTurn() && !isGameOver()) startListening();
        });
      } else {
        // Heard something but doesn't look like chess
        sayMessage(`Not sure what you said. Please speak your move, like E four or knight to F three.`, () => {
          if (activeRef.current && isMyTurn() && !isGameOver()) startListening();
        });
      }
    };

    r.onerror = (event: any) => {
      const err = event.error;
      if (err === "no-speech") {
        // Silently restart
        setPartial({ isListening: false, status: "idle" });
        if (activeRef.current && isMyTurn() && !isGameOver() && !speakingRef.current) {
          setTimeout(() => startListening(), 300);
        }
        return;
      }
      if (err === "aborted") {
        setPartial({ isListening: false, status: "idle" });
        return;
      }
      setPartial({ isListening: false, status: "error", errorMessage: `Mic error: ${err}` });
    };

    r.onend = () => {
      setPartial({ isListening: false });
      if (stateRef.current.status === "listening") {
        setPartial({ status: "idle" });
      }
    };

    try {
      r.start();
    } catch (e) {
      console.warn("Voice recognition start failed:", e);
    }
  }, [gameRef, isMyTurn, isGameOver, onMove, sayMessage, setPartial]);

  const stopListening = useCallback(() => {
    activeRef.current = false;
    stopSpeaking();
    speakingRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setPartial({ isListening: false, status: "idle" });
  }, [setPartial]);

  const manualListen = useCallback(() => {
    if (!isMyTurn() || isGameOver() || speakingRef.current) return;
    activeRef.current = true;
    startListening();
  }, [isMyTurn, isGameOver, startListening]);

  // ── Auto-listen when it becomes our turn ─────────────────────────────────
  const myTurn = isMyTurn();
  const gameOver = isGameOver();

  useEffect(() => {
    if (!SR) return;
    if (myTurn && !gameOver && gameStarted && isMultiplayer) {
      // Small delay to let the board update and any pending TTS finish
      const timer = setTimeout(() => {
        if (isMyTurn() && !isGameOver() && !speakingRef.current) {
          activeRef.current = true;
          sayMessage("Your turn. Speak your move.", () => {
            if (activeRef.current && isMyTurn() && !isGameOver()) startListening();
          });
        }
      }, 600);
      return () => clearTimeout(timer);
    } else {
      // Not our turn — stop listening
      activeRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }
      setPartial({ isListening: false, status: "idle" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTurn, gameOver, gameStarted, isMultiplayer]);

  // Solo mode: auto-listen when it's white's turn
  useEffect(() => {
    if (!SR || isMultiplayer) return;
    if (myTurn && !gameOver) {
      const timer = setTimeout(() => {
        if (isMyTurn() && !isGameOver() && !speakingRef.current) {
          activeRef.current = true;
          startListening();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTurn, gameOver, isMultiplayer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      stopListening();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...state, stopListening, manualListen };
}