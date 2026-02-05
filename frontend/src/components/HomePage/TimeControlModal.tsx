import React, { useEffect, useRef, useMemo } from "react";
import "./Modal.css";
import "./TimeControlModal.css";
import { FiZap, FiClock, FiTarget, FiShield, FiLoader } from "react-icons/fi";
import { useGameModes, getDefaultGameModes } from "../../hooks/useGameModes";
import { GameModeDto } from "../../api/admin";

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

type TimeControlCategory = {
  name: string;
  icon: React.ReactNode;
  color: string;
  controls: { label: string; time: TimeControl; description: string; gameMode?: GameModeDto }[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (tc: TimeControl) => void;
  /** shown in the header: "Voice Chess" / "Classic Chess" */
  modeLabel?: string;
};

const TimeControlModal: React.FC<Props> = ({
  open,
  onClose,
  onPick,
  modeLabel = "Voice Chess",
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { gameModes, loading } = useGameModes();

  // Organize game modes into categories
  const timeControls: TimeControlCategory[] = useMemo(() => {
    const modes = gameModes.length > 0 ? gameModes : getDefaultGameModes();
    
    // Group modes by category based on time
    const categorized: { [key: string]: GameModeDto[] } = {
      BULLET: [],
      BLITZ: [],
      RAPID: [],
      CLASSICAL: [],
    };

    modes.forEach((mode) => {
      if (mode.minTimeMinutes <= 2) {
        categorized.BULLET.push(mode);
      } else if (mode.minTimeMinutes <= 5) {
        categorized.BLITZ.push(mode);
      } else if (mode.minTimeMinutes <= 25) {
        categorized.RAPID.push(mode);
      } else {
        categorized.CLASSICAL.push(mode);
      }
    });

    return [
      {
        name: "⚡ Bullet",
        icon: <FiZap />,
        color: "bullet",
        controls: categorized.BULLET.map((mode) => ({
          label: `${mode.minTimeMinutes}+${mode.incrementSeconds}`,
          time: `${mode.minTimeMinutes}+${mode.incrementSeconds}` as TimeControl,
          description: mode.description || mode.displayName,
          gameMode: mode,
        })).sort((a, b) => 
          (a.gameMode?.minTimeMinutes || 0) - (b.gameMode?.minTimeMinutes || 0)
        ),
      },
      {
        name: "🔥 Blitz",
        icon: <FiClock />,
        color: "blitz",
        controls: categorized.BLITZ.map((mode) => ({
          label: `${mode.minTimeMinutes}+${mode.incrementSeconds}`,
          time: `${mode.minTimeMinutes}+${mode.incrementSeconds}` as TimeControl,
          description: mode.description || mode.displayName,
          gameMode: mode,
        })).sort((a, b) => 
          (a.gameMode?.minTimeMinutes || 0) - (b.gameMode?.minTimeMinutes || 0)
        ),
      },
      {
        name: "⏳ Rapid",
        icon: <FiTarget />,
        color: "rapid",
        controls: categorized.RAPID.map((mode) => ({
          label: `${mode.minTimeMinutes}+${mode.incrementSeconds}`,
          time: `${mode.minTimeMinutes}+${mode.incrementSeconds}` as TimeControl,
          description: mode.description || mode.displayName,
          gameMode: mode,
        })).sort((a, b) => 
          (a.gameMode?.minTimeMinutes || 0) - (b.gameMode?.minTimeMinutes || 0)
        ),
      },
      {
        name: "🕰 Classical",
        icon: <FiShield />,
        color: "classical",
        controls: categorized.CLASSICAL.map((mode) => ({
          label: `${mode.minTimeMinutes}+${mode.incrementSeconds}`,
          time: `${mode.minTimeMinutes}+${mode.incrementSeconds}` as TimeControl,
          description: mode.description || mode.displayName,
          gameMode: mode,
        })).sort((a, b) => 
          (a.gameMode?.minTimeMinutes || 0) - (b.gameMode?.minTimeMinutes || 0)
        ),
      },
    ];
  }, [gameModes]);

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
          {loading && <span className="loading-badge"><FiLoader className="spinning" /> Loading modes...</span>}
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

export default TimeControlModal;
