import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiZap,
  FiClock,
  FiTarget,
  FiShield,
  FiUsers,
  FiShuffle,
  FiMic,
  FiArrowLeft,
} from "react-icons/fi";

import deepgramVoiceCommandService from "../utils/deepgramVoiceCommandService";
import deepgramTTSService from "../utils/deepgramTTSService";
import Navbar from "../components/Navbar/Navbar";
import { GlobalVoiceParser } from "../utils/globalVoiceParser";
import "./HomePage.css";

/* =========================================================
   Types shared across the merged components
   ========================================================= */
export type TimeControl =
  // Bullet
  | "1+0"
  | "1+1"
  | "2+1"
  | "2+0"
  | "0.5+0"
  // Blitz
  | "3+0"
  | "3+2"
  | "5+0"
  | "5+3"
  | "4+2"
  // Rapid
  | "10+0"
  | "10+5"
  | "15+10"
  | "15+0"
  | "25+10"
  // Classical
  | "90+30"
  | "60+0"
  | "60+30"
  | "120+30"
  | "90/40+30";

export type VersusChoice = "random" | "friends";

/* =========================================================
   PlayStyleCard (from PlayStyleCard.tsx)
   ========================================================= */

type PlayStyleProps = {
  variant: "voice" | "classic";
  badge?: string;
  bullets: string[];
  cta: string;
  onStart: () => void;
};

const PlayStyleCard: React.FC<PlayStyleProps> = ({
  variant,
  badge,
  bullets,
  cta,
  onStart,
}) => {
  return (
    <article className={`playstyle ${variant}`}>
      <header className="ps-head">
        <span className="ps-ico">{variant === "voice" ? "🎤" : "🎯"}</span>
        {badge && <span className="ps-badge">{badge}</span>}
      </header>

      <h3 className="ps-title">
        {variant === "voice" ? "Play with Voice" : "Play Chess"}
      </h3>
      <p className="ps-sub">
        {variant === "voice"
          ? "Experience chess like never before with voice commands"
          : "Traditional chess gameplay with modern features"}
      </p>

      <ul className="ps-list">
        {bullets.map((b, i) => (
          <li key={i}>
            <span className="dot" />
            {b}
          </li>
        ))}
      </ul>

      <button
        className={`ps-cta ${variant === "voice" ? "btn-gold" : "btn-dark"}`}
        onClick={onStart}
      >
        {cta} {variant === "voice" ? <span>⚡</span> : <span>♞</span>}
      </button>
    </article>
  );
};

/* =========================================================
   StatsPanel (from StatsPanel.tsx)
   ========================================================= */

interface StatsPanelProps {
  winRate: number;
  gamesPlayed: number;
  winStreak: number;
}

const StatsPanel: React.FC<StatsPanelProps> = ({
  winRate,
  gamesPlayed,
  winStreak,
}) => (
  <div className="panel stats-panel">
    <div className="panel-head">
      <span className="dot"></span>
      <h3>Your Statistics</h3>
    </div>

    <div className="statbar">
      <div className="label-row">
        <span>Win Rate</span>
        <span className="rate-val">{winRate}%</span>
      </div>
      <div className="bar">
        <div className="fill" style={{ width: `${winRate}%` }}></div>
      </div>
    </div>

    <div className="stats-mini">
      <div className="mini">
        <div className="num">{gamesPlayed}</div>
        <div className="cap">Games Played</div>
      </div>
      <div className="mini">
        <div className="num gold">{winStreak}</div>
        <div className="cap">Win Streak</div>
      </div>
    </div>
  </div>
);

/* =========================================================
   RecentGames (from RecentGames.tsx)
   ========================================================= */

const recentRows = [
  {
    name: "AlexChess92",
    mode: "10+0",
    moves: 34,
    result: "Won +12",
    ago: "2 hours ago",
    color: "green",
    hasVoice: true,
  },
  {
    name: "ChessMaster",
    mode: "5+3",
    moves: 42,
    result: "Lost -8",
    ago: "1 day ago",
    color: "red",
    hasVoice: false,
  },
  {
    name: "KnightRider",
    mode: "15+10",
    moves: 28,
    result: "Won +15",
    ago: "2 days ago",
    color: "green",
    hasVoice: true,
  },
];

const RecentGames: React.FC = () => (
  <div className="panel recent">
    <div className="rg-head">
      <h3>Recent Games</h3>
      <button className="btn-dark small">View All</button>
    </div>
    <div className="rg-list">
      {recentRows.map((r, i) => (
        <div className="rg-row" key={i}>
          <div className="rg-left">
            <span className={`dot ${r.color}`} />
            <div className="rg-info">
              <div className="rg-name">
                {r.name}
                {r.hasVoice && <span className="tag">Voice</span>}
              </div>
              <div className="rg-meta">
                {r.mode} • {r.moves} moves
              </div>
            </div>
          </div>
          <div className="rg-right">
            <div className={`rg-result ${r.color}`}>{r.result}</div>
            <div className="rg-ago">{r.ago}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* =========================================================
   LeaderboardPromo (from LeaderboardPromo.tsx)
   ========================================================= */

const LeaderboardPromo: React.FC = () => (
  <div className="panel leaderboard-promo">
    <div className="promo-img">
      <span className="img-placeholder">🏆</span>
    </div>
    <div className="promo-content">
      <h3>Tournament Mode</h3>
      <button className="btn-gold">🏆 View Leaderboard</button>
    </div>
  </div>
);

/* =========================================================
   VoiceTip (from VoiceTip.tsx)
   ========================================================= */

const VoiceTip: React.FC = () => (
  <div className="panel voice-tip">
    <div className="tip-head">
      <span className="tip-icon">🔊</span>
      <h3>Voice - here's how</h3>
    </div>
    <p className="tip-text">
      "Use natural language! You can say 'Knight to F3' or 'Move knight F3' -
      our AI understands both!"
    </p>
    <button className="btn-dark">Voice Settings</button>
  </div>
);

/* =========================================================
   TimeControlModal (from TimeControlModal.tsx)
   ========================================================= */

type TimeControlModalProps = {
  open: boolean;
  onClose: () => void;
  onPick: (tc: TimeControl) => void;
  modeLabel?: string;
};

const TimeControlModal: React.FC<TimeControlModalProps> = ({
  open,
  onClose,
  onPick,
  modeLabel = "Voice Chess",
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  const timeControls = [
    {
      name: "⚡ Bullet",
      icon: <FiZap />,
      color: "bullet",
      controls: [
        { label: "1+0", time: "1+0" as TimeControl, description: "Ultra-fast" },
        {
          label: "1+1",
          time: "1+1" as TimeControl,
          description: "1 min + 1 sec",
        },
        {
          label: "2+1",
          time: "2+1" as TimeControl,
          description: "2 min + 1 sec",
        },
        { label: "2+0", time: "2+0" as TimeControl, description: "2 minutes" },
        {
          label: "30+0",
          time: "0.5+0" as TimeControl,
          description: "30 seconds",
        },
      ],
    },
    {
      name: "🔥 Blitz",
      icon: <FiClock />,
      color: "blitz",
      controls: [
        { label: "3+0", time: "3+0" as TimeControl, description: "3 minutes" },
        {
          label: "3+2",
          time: "3+2" as TimeControl,
          description: "3 min + 2 sec",
        },
        { label: "5+0", time: "5+0" as TimeControl, description: "5 minutes" },
        {
          label: "5+3",
          time: "5+3" as TimeControl,
          description: "5 min + 3 sec",
        },
        {
          label: "4+2",
          time: "4+2" as TimeControl,
          description: "4 min + 2 sec",
        },
      ],
    },
    {
      name: "⏳ Rapid",
      icon: <FiTarget />,
      color: "rapid",
      controls: [
        {
          label: "10+0",
          time: "10+0" as TimeControl,
          description: "10 minutes",
        },
        {
          label: "10+5",
          time: "10+5" as TimeControl,
          description: "10 min + 5 sec",
        },
        {
          label: "15+10",
          time: "15+10" as TimeControl,
          description: "15 min + 10 sec",
        },
        {
          label: "15+0",
          time: "15+0" as TimeControl,
          description: "15 minutes",
        },
        {
          label: "25+10",
          time: "25+10" as TimeControl,
          description: "25 min + 10 sec",
        },
      ],
    },
    {
      name: "🕰 Classical",
      icon: <FiShield />,
      color: "classical",
      controls: [
        {
          label: "90+30",
          time: "90+30" as TimeControl,
          description: "1.5 hrs + 30 sec",
        },
        { label: "60+0", time: "60+0" as TimeControl, description: "1 hour" },
        {
          label: "60+30",
          time: "60+30" as TimeControl,
          description: "1 hr + 30 sec",
        },
        {
          label: "120+30",
          time: "120+30" as TimeControl,
          description: "2 hrs + 30 sec",
        },
        {
          label: "90/40+30",
          time: "90/40+30" as TimeControl,
          description: "90 min 40 moves + 30 sec",
        },
      ],
    },
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="modal-card time-selector-dialog"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        tabIndex={-1}
      >
        <header className="modal-head">
          <h3>{modeLabel}</h3>
          <p>Select your preferred time control</p>
          <button className="x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="time-controls-scroll">
          {timeControls.map((category) => (
            <div
              key={category.color}
              className={`time-category ${category.color}`}
            >
              <div className="category-header">
                <span className="category-icon">{category.icon}</span>
                <h4 className="category-title">{category.name}</h4>
              </div>
              <div className="time-options-container">
                {category.controls.map((control) => (
                  <button
                    key={control.time}
                    className="time-option-card"
                    onClick={() => onPick(control.time)}
                    title={`${control.label} - ${control.description}`}
                  >
                    <div className="time-option-label">{control.label}</div>
                    <div className="time-option-description">
                      {control.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="time-format-hint">
          Time format: Minutes + increment per move
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   VersusModal (from VersusModal.tsx)
   ========================================================= */

type VersusModalProps = {
  open: boolean;
  onClose: () => void;
  onPick: (v: VersusChoice) => void;
  selectedTime: TimeControl | null;
  modeLabel?: string;
};

const VersusModal: React.FC<VersusModalProps> = ({
  open,
  onClose,
  onPick,
  selectedTime,
  modeLabel = "Voice Chess",
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="modal-card opponent-selector-dialog"
        onClick={(e) => e.stopPropagation()}
        ref={ref}
        tabIndex={-1}
      >
        <header className="modal-head">
          <h3>
            {modeLabel}{" "}
            {selectedTime && <span className="small">• {selectedTime}</span>}
          </h3>
          <p>Choose how you want to play</p>
          <button className="x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="opponent-options-list">
          <button
            className="opponent-option-item highlight-option"
            onClick={() => onPick("random")}
          >
            <span className="opponent-option-icon icon-random">
              <FiShuffle />
            </span>
            <div className="opponent-option-content">
              <div className="opponent-option-title">Play Random</div>
              <div className="opponent-option-description">
                Match with a random opponent instantly
              </div>
            </div>
          </button>

          <button
            className="opponent-option-item"
            onClick={() => onPick("friends")}
          >
            <span className="opponent-option-icon icon-friends">
              <FiUsers />
            </span>
            <div className="opponent-option-content">
              <div className="opponent-option-title">Play with Friends</div>
              <div className="opponent-option-description">
                Invite a friend to play together
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   VoiceCommandsModal (from VoiceCommandModal.tsx)
   ========================================================= */

type VoiceCommandsModalProps = {
  open: boolean;
  onClose: () => void;
};

const VoiceCommandsModal: React.FC<VoiceCommandsModalProps> = ({
  open,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const commandGroups = [
    {
      icon: <FiMic />,
      title: "Game Mode Selection",
      color: "#ffd700",
      commands: [
        { text: "Start voice chess", example: "Say: 'Start voice chess'" },
        { text: "Start classic chess", example: "Say: 'Start classic chess'" },
        { text: "Play voice", example: "Say: 'Play voice'" },
        { text: "Play classic", example: "Say: 'Play classic'" },
      ],
    },
    {
      icon: <FiClock />,
      title: "Time Control",
      color: "#ff9633",
      commands: [
        { text: "Bullet", example: "Say: 'Bullet' or '1 minute'" },
        { text: "Blitz", example: "Say: 'Blitz' or '5 minutes'" },
        { text: "Rapid", example: "Say: 'Rapid' or '10 minutes'" },
        { text: "Classical", example: "Say: 'Classical' or '15 minutes'" },
      ],
    },
    {
      icon: <FiUsers />,
      title: "Opponent Selection",
      color: "#818cf8",
      commands: [
        { text: "Play random", example: "Say: 'Play random' or 'Random'" },
        {
          text: "Play with friends",
          example: "Say: 'Play with friends' or 'Friends'",
        },
        {
          text: "Find opponent",
          example: "Say: 'Find opponent' or 'Match me'",
        },
      ],
    },
    {
      icon: <FiArrowLeft />,
      title: "Navigation & Help",
      color: "#d64b4b",
      commands: [
        { text: "Go back", example: "Say: 'Go back' or 'Back'" },
        { text: "Show commands", example: "Say: 'Show commands' or 'Help'" },
        {
          text: "Stop listening",
          example: "Say: 'Stop listening' or 'Stop voice'",
        },
      ],
    },
  ];

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="modal-card voice-commands-dialog"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        tabIndex={-1}
        style={{
          width: "min(820px, 94vw)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <header className="modal-head" style={{ paddingBottom: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "8px",
            }}
          >
            <span
              style={{
                fontSize: "2rem",
                filter: "drop-shadow(0 0 12px rgba(255, 215, 0, 0.5))",
              }}
            >
              🎤
            </span>
            <h3>Voice Commands</h3>
          </div>
          <p>
            Speak naturally - our AI understands variations of these commands
          </p>
          <button className="x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        {/* Content */}
        <div style={{ padding: "24px 28px 28px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "20px",
            }}
          >
            {commandGroups.map((group, idx) => (
              <CommandGroup key={idx} {...group} />
            ))}
          </div>

          {/* Tip Section */}
          <div
            style={{
              marginTop: "24px",
              padding: "16px 20px",
              background: "rgba(255, 215, 0, 0.08)",
              border: "1px solid rgba(255, 215, 0, 0.25)",
              borderRadius: "12px",
              display: "flex",
              gap: "12px",
              alignItems: "flex-start",
            }}
          >
            <span style={{ fontSize: "1.3rem" }}>💡</span>
            <div>
              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "#ffd700",
                  marginBottom: "4px",
                }}
              >
                Pro Tip
              </div>
              <div
                style={{
                  fontSize: "0.88rem",
                  color: "#d0d0d0",
                  lineHeight: "1.5",
                }}
              >
                You don't need to say the exact phrase! Our AI understands
                natural variations like "I want to play bullet" or "Choose blitz
                mode".
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

type CommandGroupProps = {
  icon: React.ReactNode;
  title: string;
  color: string;
  commands: Array<{ text: string; example: string }>;
};

const CommandGroup: React.FC<CommandGroupProps> = ({
  icon,
  title,
  color,
  commands,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #1f1f1f 0%, #1a1a1a 100%)",
        border: `1px solid ${isHovered ? `${color}40` : "#2d2d2d"}`,
        borderRadius: "16px",
        padding: "20px",
        transition: "all 0.3s ease",
        transform: isHovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: isHovered
          ? `0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px ${color}20 inset`
          : "none",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            background: `${color}20`,
            color: color,
            display: "grid",
            placeItems: "center",
            fontSize: "20px",
            border: `1px solid ${color}30`,
          }}
        >
          {icon}
        </div>
        <h4
          style={{
            margin: 0,
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "0.2px",
          }}
        >
          {title}
        </h4>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {commands.map((cmd, cmdIdx) => (
          <CommandItem key={cmdIdx} {...cmd} />
        ))}
      </div>
    </div>
  );
};

type CommandItemProps = {
  text: string;
  example: string;
};

const CommandItem: React.FC<CommandItemProps> = ({ text, example }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      style={{
        padding: "12px 14px",
        background: isHovered
          ? "rgba(255, 255, 255, 0.04)"
          : "rgba(255, 255, 255, 0.02)",
        border: `1px solid ${
          isHovered ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.06)"
        }`,
        borderRadius: "10px",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        style={{
          fontSize: "0.95rem",
          fontWeight: 600,
          color: "#e0e0e0",
          marginBottom: "4px",
        }}
      >
        "{text}"
      </div>
      <div
        style={{
          fontSize: "0.82rem",
          color: "#888",
          fontStyle: "italic",
        }}
      >
        {example}
      </div>
    </div>
  );
};

/* =========================================================
   HomePage main component - OPTIMIZED VERSION
   ========================================================= */

const HomePage: React.FC = () => {
  const welcomePlayedRef = useRef(false);
  const navigate = useNavigate();

  // Modal states
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [versusModalOpen, setVersusModalOpen] = useState(false);
  const [commandsModalOpen, setCommandsModalOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"voice" | "classic" | null>(
    null
  );
  const [selectedTime, setSelectedTime] = useState<TimeControl | null>(null);

  // Voice recognition states
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");

  // Refs to track pending actions
  const pendingModeRef = useRef<"voice" | "classic" | null>(null);
  const pendingTimeRef = useRef<TimeControl | null>(null);
  const isNavigatingRef = useRef(false);

  // ✅ OPTIMIZED: Single useEffect for welcome + voice initialization
  useEffect(() => {
    const initializeVoiceAndWelcome = async () => {
      if (welcomePlayedRef.current) {
        console.log("✅ Welcome already played - skipping");
        return;
      }

      welcomePlayedRef.current = true;

      // ✅ Step 1: Initialize Deepgram services
      try {
        console.log("🎤 Initializing Deepgram services...");
        await deepgramVoiceCommandService.initialize();
        console.log("✅ Deepgram services initialized");
      } catch (e) {
        console.warn("⚠️ Failed to initialize Deepgram:", e);
        // Don't auto-start STT if initialization fails
        return;
      }

      // ✅ Step 2: Play ULTRA-SHORT welcome message (reduced from 600+ chars to ~80 chars)
      const welcomeText = `Welcome to Chess for Everyone! Say "show commands" to see what you can do, or say "start voice chess" to begin.`;

      console.log("🔊 Playing welcome message...");

      try {
        await deepgramTTSService.speak({
          text: welcomeText,
          rate: 1.0,
          volume: 0.9,
          priority: "high",
          onStart: () => {
            console.log("▶️ Welcome message started");
          },
          onEnd: () => {
            console.log("✅ Welcome message completed");

            // ✅ Step 3: Start voice recognition after a brief pause for user to process
            setTimeout(() => {
              if (!deepgramVoiceCommandService.isActive()) {
                console.log("🎤 Starting voice recognition after welcome...");
                startVoiceListening();
              }
            }, 1500); // 1.5 second buffer to let user process what was said
          },
          onError: (err) => {
            console.warn("⚠️ Welcome speech error:", err);
            // ❌ DO NOT auto-start STT if TTS fails
            // User must manually click "Voice On" button
            console.log("ℹ️ TTS failed - voice commands NOT auto-started");
            console.log(
              "ℹ️ Click 'Voice On' button to enable voice commands manually"
            );
          },
        });
      } catch (e) {
        console.error("❌ Welcome speech failed:", e);
        // ❌ DO NOT auto-start STT if TTS fails
        // User must manually click "Voice On" button
        console.log("ℹ️ TTS failed - voice commands NOT auto-started");
        console.log(
          "ℹ️ Click 'Voice On' button to enable voice commands manually"
        );
      }
    };

    initializeVoiceAndWelcome();

    // ✅ Cleanup on unmount - SINGLE cleanup function
    return () => {
      console.log("🧹 HomePage unmounting - cleaning up voice services");
      deepgramTTSService.stop();
      deepgramVoiceCommandService.stopListening();
    };
  }, []); // Run once on mount

  const startVoiceListening = () => {
    console.log("🎤 Starting voice listening...");

    deepgramVoiceCommandService.startListening({
      language: "en-IN", // Indian English for South Asian accents
      onListeningStart: () => {
        setIsVoiceActive(true);
        console.log("🎤 Voice commands active");
      },
      onListeningStop: () => {
        setIsVoiceActive(false);
        console.log("🛑 Voice commands stopped");
      },
      onError: (error) => {
        console.error("❌ Voice error:", error);
        setIsVoiceActive(false);
      },
      onCommand: handleVoiceCommand,
      onTranscript: (transcript, isFinal) => {
        setCurrentTranscript(transcript);
        if (isFinal) {
          setTimeout(() => setCurrentTranscript(""), 2000);
        }
      },
    });
  };

  // Helper to speak with voice pause/resume
  const speak = async (text: string) => {
    if (!text || !text.trim()) return;

    try {
      // Pause voice listening while TTS speaks
      if (deepgramVoiceCommandService.isActive()) {
        deepgramVoiceCommandService.pauseListening();
      }

      await deepgramTTSService.speak({
        text,
        rate: 1.0,
        volume: 0.8,
      });

      // Resume voice listening after TTS completes
      if (welcomePlayedRef.current && deepgramVoiceCommandService.isActive()) {
        deepgramVoiceCommandService.resumeListening();
      }
    } catch (e) {
      console.warn("Speech failed:", e);
    }
  };

  // Map voice commands to time controls
  const timeControlMap: { [key: string]: TimeControl } = {
    SELECT_BULLET_1_0: "1+0",
    SELECT_BULLET_1_1: "1+1",
    SELECT_BULLET_2_0: "2+0",
    SELECT_BULLET_2_1: "2+1",
    SELECT_BULLET_30_0: "0.5+0",
    SELECT_BLITZ_3_0: "3+0",
    SELECT_BLITZ_3_2: "3+2",
    SELECT_BLITZ_4_2: "4+2",
    SELECT_BLITZ_5_0: "5+0",
    SELECT_BLITZ_5_3: "5+3",
    SELECT_RAPID_10_0: "10+0",
    SELECT_RAPID_10_5: "10+5",
    SELECT_RAPID_15_0: "15+0",
    SELECT_RAPID_15_10: "15+10",
    SELECT_RAPID_25_10: "25+10",
    SELECT_CLASSICAL_60_0: "60+0",
    SELECT_CLASSICAL_60_30: "60+30",
    SELECT_CLASSICAL_90_30: "90+30",
    SELECT_CLASSICAL_120_30: "120+30",
    SELECT_CLASSICAL_90_40_30: "90/40+30",
  };

  const announceTimeControls = async (category: string) => {
    const timeControlInfo: { [key: string]: string } = {
      bullet:
        "Bullet time controls are: 1 plus 0, 1 plus 1, 2 plus 1, 2 plus 0, and 30 seconds. Say the time you want, for example, say bullet 1 plus 0.",
      blitz:
        "Blitz time controls are: 3 plus 0, 3 plus 2, 5 plus 0, 5 plus 3, and 4 plus 2. Say the time you want, for example, say blitz 5 plus 0.",
      rapid:
        "Rapid time controls are: 10 plus 0, 10 plus 5, 15 plus 10, 15 plus 0, and 25 plus 10. Say the time you want, for example, say rapid 10 plus 0.",
      classical:
        "Classical time controls are: 90 plus 30, 60 plus 0, 60 plus 30, 120 plus 30, and 90 by 40 plus 30. Say the time you want, for example, say classical 60 plus 0.",
    };

    const message = timeControlInfo[category];
    if (message) {
      try {
        await speak(message);
      } catch (e) {
        console.warn("Failed to announce time controls:", e);
      }
    }
  };

  // Provide audio feedback
  const provideFeedback = async (intent: string) => {
    const feedbackMessages: { [key: string]: string } = {
      START_VOICE_CHESS: "Starting voice chess",
      START_CLASSIC_CHESS: "Starting classic chess",
      SELECT_BULLET_1_0: "Bullet 1 plus 0 selected",
      SELECT_BULLET_1_1: "Bullet 1 plus 1 selected",
      SELECT_BULLET_2_0: "Bullet 2 plus 0 selected",
      SELECT_BULLET_2_1: "Bullet 2 plus 1 selected",
      SELECT_BULLET_30_0: "30 seconds selected",
      SELECT_BLITZ_3_0: "Blitz 3 plus 0 selected",
      SELECT_BLITZ_3_2: "Blitz 3 plus 2 selected",
      SELECT_BLITZ_4_2: "Blitz 4 plus 2 selected",
      SELECT_BLITZ_5_0: "Blitz 5 plus 0 selected",
      SELECT_BLITZ_5_3: "Blitz 5 plus 3 selected",
      SELECT_RAPID_10_0: "Rapid 10 plus 0 selected",
      SELECT_RAPID_10_5: "Rapid 10 plus 5 selected",
      SELECT_RAPID_15_0: "Rapid 15 plus 0 selected",
      SELECT_RAPID_15_10: "Rapid 15 plus 10 selected",
      SELECT_RAPID_25_10: "Rapid 25 plus 10 selected",
      SELECT_CLASSICAL_60_0: "Classical 1 hour selected",
      SELECT_CLASSICAL_60_30: "Classical 60 plus 30 selected",
      SELECT_CLASSICAL_90_30: "Classical 90 plus 30 selected",
      SELECT_CLASSICAL_120_30: "Classical 120 plus 30 selected",
      SELECT_RANDOM: "Random opponent selected",
      SELECT_FRIENDS: "Play with friends selected",
      GO_BACK: "Going back",
      SHOW_COMMANDS: "Opening commands",
    };

    const message = feedbackMessages[intent];
    if (message) {
      try {
        await speak(message);
      } catch (e) {
        console.warn("Feedback speech failed:", e);
      }
    }
  };

  // Announce versus options
  const announceVersusOptions = async () => {
    if (deepgramTTSService.isSupportedBrowser()) {
      const announcement =
        "Choose your opponent. Say play random to play against a random opponent, or say play with friends to play with someone you know.";
      try {
        await speak(announcement);
      } catch (e) {
        console.warn("Failed to announce versus options:", e);
      }
    }
  };

  // Handle start voice chess
  const handleStartVoiceChess = async () => {
    console.log("🎤 Starting Voice Chess");
    setSelectedMode("voice");
    pendingModeRef.current = "voice";
    setTimeModalOpen(true);
    setVersusModalOpen(false);

    if (deepgramTTSService.isSupportedBrowser()) {
      const announcement =
        "Voice chess started. You can select from the following time control categories. Bullet for ultra-fast games. Blitz for fast games. Rapid for medium speed games. Or Classical for slow games. You can say the category name or say time controls followed by the category name to hear all options.";
      try {
        await speak(announcement);
      } catch (e) {
        console.warn("Failed to announce time controls:", e);
      }
    }
  };

  // Handle start classic chess
  const handleStartClassicChess = () => {
    console.log("♟️ Starting Classic Chess");
    setSelectedMode("classic");
    pendingModeRef.current = "classic";
    setTimeModalOpen(true);
    setVersusModalOpen(false);
  };

  // Handle time selection
  const handleTimeSelection = (time: TimeControl) => {
    console.log("⏱️ Time selected:", time);
    setSelectedTime(time);
    pendingTimeRef.current = time;

    // Always close modal when time is picked
    setTimeModalOpen(false);

    const mode = selectedMode || pendingModeRef.current;
    if (!mode) {
      console.warn("No mode selected, defaulting to voice");
      setSelectedMode("voice");
      pendingModeRef.current = "voice";
    }

    setTimeout(() => {
      setVersusModalOpen(true);
      setTimeout(() => {
        announceVersusOptions();
      }, 300);
    }, 300);
  };

  // Handle opponent selection
  const handleOpponentSelection = (choice: VersusChoice) => {
    console.log("👥 Opponent selected:", choice);

    const mode = selectedMode || pendingModeRef.current;
    const time = selectedTime || pendingTimeRef.current;

    console.log("📍 Current state:", { mode, time, choice });

    isNavigatingRef.current = true;

    deepgramTTSService.stop();

    const gameConfig = {
      mode: mode || "voice",
      time: time,
      versus: choice,
    };
    sessionStorage.setItem("gameConfig", JSON.stringify(gameConfig));
    console.log("✅ Game config saved:", gameConfig);

    setVersusModalOpen(false);
    setTimeModalOpen(false);

    setSelectedMode(null);
    setSelectedTime(null);
    pendingModeRef.current = null;
    pendingTimeRef.current = null;

    setTimeout(() => {
      const targetRoute = mode === "classic" ? "/classicchess" : "/voicechess";
      console.log(`🚀 Navigating to ${targetRoute}`);

      navigate(targetRoute, {
        state: {
          timeControl: time,
          versus: choice,
          mode: mode || "voice",
        },
        replace: false,
      });
    }, 150);
  };

  // Handle go back
  const handleGoBack = () => {
    deepgramTTSService.stop();

    if (versusModalOpen) {
      console.log("⬅️ Going back from versus to time selection");
      setVersusModalOpen(false);
      setTimeout(() => {
        setTimeModalOpen(true);
      }, 200);
    } else if (timeModalOpen) {
      console.log("⬅️ Going back from time selection to home");
      setTimeModalOpen(false);
      setSelectedMode(null);
      pendingModeRef.current = null;
    }
  };

  // Handle voice command
  const handleVoiceCommand = async (command: any) => {
    console.log("🎯 Processing command:", command.intent);
    console.log("🗣️ Transcript:", command.originalText);

    // Voice control commands
    if (command.intent === "VOICE_ON") {
      deepgramVoiceCommandService.setVoiceEnabled(true);
      await speak("Voice commands enabled");
      return;
    }

    if (command.intent === "VOICE_OFF") {
      deepgramVoiceCommandService.setVoiceEnabled(false);
      await speak("Voice commands disabled. Say voice on to enable again.");
      return;
    }

    if (command.intent === "VOICE_STOP") {
      console.log("🛑 Stopping speech");
      deepgramTTSService.stop();
      return;
    }

    if (command.intent === "VOICE_REPEAT") {
      console.log("🔁 Replaying message");
      await deepgramTTSService.replay();
      return;
    }

    // Time control announcements
    if (command.intent.startsWith("TIME_CONTROLS_")) {
      const category = command.intent
        .replace("TIME_CONTROLS_", "")
        .toLowerCase();
      await announceTimeControls(category);
      return;
    }

    // Specific time control selections
    if (command.intent.startsWith("SELECT_")) {
      const timeControl = timeControlMap[command.intent];
      if (timeControl) {
        if (!selectedMode && !pendingModeRef.current) {
          setSelectedMode("voice");
          pendingModeRef.current = "voice";
        }
        handleTimeSelection(timeControl);
        provideFeedback(command.intent);
        return;
      }
    }

    // Opponent selection
    if (command.intent === "SELECT_RANDOM") {
      provideFeedback(command.intent);
      handleOpponentSelection("random");
      return;
    }

    if (command.intent === "SELECT_FRIENDS") {
      provideFeedback(command.intent);
      handleOpponentSelection("friends");
      return;
    }

    // Provide audio feedback for action commands
    if (!deepgramTTSService.isSpeakingNow()) {
      await provideFeedback(command.intent);
    }

    // Execute command actions
    switch (command.intent) {
      case "START_VOICE_CHESS":
        handleStartVoiceChess();
        break;

      case "START_CLASSIC_CHESS":
        handleStartClassicChess();
        break;

      case "SHOW_COMMANDS":
        deepgramTTSService.stop();
        setCommandsModalOpen(true);
        break;

      case "GO_BACK":
        handleGoBack();
        break;

      default:
        console.log("❓ Unknown command:", command.intent);
    }
  };

  // Click handlers
  const onStartVoice = () => {
    deepgramTTSService.stop();
    handleStartVoiceChess();
  };

  const onStartClassic = () => {
    deepgramTTSService.stop();
    handleStartClassicChess();
  };

  const handleTimeModalPick = (tc: TimeControl) => {
    deepgramTTSService.stop();
    handleTimeSelection(tc);
  };

  const handleVersusModalPick = (choice: VersusChoice) => {
    handleOpponentSelection(choice);
  };

  return (
    <div className="home-page">
      <Navbar rating={0} streak={0} />

      {/* Voice Status Indicator */}
      {isVoiceActive && (
        <div className="voice-status-bar">
          <div className="voice-indicator">
            <span className="voice-dot pulsing"></span>
            <span>Voice Commands Active</span>
          </div>
          {currentTranscript && (
            <div className="voice-transcript">
              You said: "{currentTranscript}"
            </div>
          )}
        </div>
      )}

      <div className="home-container">
        {/* Header */}
        <header className="home-header">
          <div className="header-left">
            <h1 className="home-title">Welcome back, Chess Player!</h1>
            <p className="home-subtitle">
              Ready for your next game? Your current rating is 1847.
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {/* Voice Commands Button */}
            <button
              className="voice-toggle-btn"
              onClick={() => {
                deepgramTTSService.stop();
                setCommandsModalOpen(true);
              }}
            >
              📋 Commands
            </button>

            {/* Voice Toggle Button */}
            <button
              className="voice-toggle-btn"
              onClick={() => {
                if (isVoiceActive) {
                  console.log("🔇 Turning off voice commands");
                  deepgramVoiceCommandService.stopListening();
                  deepgramTTSService.stop();
                } else {
                  console.log("🔊 Turning on voice commands");
                  startVoiceListening();
                }
              }}
            >
              🎤 {isVoiceActive ? "Voice On" : "Voice Off"}
            </button>
          </div>
        </header>

        {/* Play Style Section */}
        <section className="play-style-section">
          <h2>Choose Your Play Style</h2>
          <div className="play-modes">
            <PlayStyleCard
              variant="voice"
              badge="Featured"
              bullets={[
                "Hands-free gameplay",
                "AI-powered voice recognition",
                "Real-time move suggestions",
                "Enhanced accessibility",
              ]}
              cta="Start Voice Chess"
              onStart={onStartVoice}
            />
            <PlayStyleCard
              variant="classic"
              bullets={[
                "Classic point-and-click",
                "Multiple time controls",
                "Advanced AI analysis",
                "Tournament ready",
              ]}
              cta="Start Classic Chess"
              onStart={onStartClassic}
            />
          </div>
        </section>

        {/* Quick Stats */}
        <section style={{ marginTop: "40px" }}>
          <h3 className="quick-stats-title">Quick Stats</h3>
          <div className="quick-stats">
            <div className="stat-card">
              <span className="icon">🏆</span>
              <div className="value">142</div>
              <div className="label">Games Played</div>
            </div>
            <div className="stat-card">
              <span className="icon">🎯</span>
              <div className="value">68%</div>
              <div className="label">Win Rate</div>
            </div>
            <div className="stat-card">
              <span className="icon">📊</span>
              <div className="value">1847</div>
              <div className="label">Rating</div>
            </div>
            <div className="stat-card">
              <span className="icon">🔥</span>
              <div className="value">5</div>
              <div className="label">Win Streak</div>
            </div>
          </div>
        </section>

        {/* Main Grid */}
        <div className="home-grid" style={{ marginTop: "40px" }}>
          <div className="grid-left">
            <RecentGames />
          </div>

          <div className="grid-right">
            <StatsPanel winRate={68} gamesPlayed={142} winStreak={5} />
            <LeaderboardPromo />
            <VoiceTip />
          </div>
        </div>
      </div>

      {/* Modals */}
      <TimeControlModal
        open={timeModalOpen}
        onClose={() => {
          deepgramTTSService.stop();
          setTimeModalOpen(false);
          setSelectedMode(null);
          pendingModeRef.current = null;
        }}
        onPick={handleTimeModalPick}
        modeLabel={selectedMode === "voice" ? "Voice Chess" : "Classic Chess"}
      />

      <VersusModal
        open={versusModalOpen}
        onClose={() => {
          deepgramTTSService.stop();
          setVersusModalOpen(false);
        }}
        onPick={handleVersusModalPick}
        selectedTime={selectedTime}
        modeLabel={selectedMode === "voice" ? "Voice Chess" : "Classic Chess"}
      />

      {/* Voice Commands Modal */}
      <VoiceCommandsModal
        open={commandsModalOpen}
        onClose={() => {
          deepgramTTSService.stop();
          setCommandsModalOpen(false);
        }}
      />
    </div>
  );
};

export default HomePage;
