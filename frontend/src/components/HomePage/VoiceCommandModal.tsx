import React, { useEffect, useRef } from "react";
import { FiMic, FiClock, FiUsers, FiArrowLeft } from "react-icons/fi";
import "./Modal.css"; // Reuse existing modal styles

type Props = {
  open: boolean;
  onClose: () => void;
};

const VoiceCommandsModal: React.FC<Props> = ({ open, onClose }) => {
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

// Command Group Component
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

// Command Item Component
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

export default VoiceCommandsModal;
