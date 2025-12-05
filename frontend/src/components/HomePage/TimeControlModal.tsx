import React, { useEffect, useRef } from "react";
import "./Modal.css";
import "./TimeControlModal.css";
import { FiZap, FiClock, FiTarget, FiShield } from "react-icons/fi";

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
  controls: { label: string; time: TimeControl; description: string }[];
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

  const timeControls: TimeControlCategory[] = [
    {
      name: "⚡ Bullet",
      icon: <FiZap />,
      color: "bullet",
      controls: [
        { label: "1+0", time: "1+0", description: "Ultra-fast" },
        { label: "1+1", time: "1+1", description: "1 min + 1 sec" },
        { label: "2+1", time: "2+1", description: "2 min + 1 sec" },
        { label: "2+0", time: "2+0", description: "2 minutes" },
        { label: "30+0", time: "0.5+0", description: "30 seconds" },
      ],
    },
    {
      name: "🔥 Blitz",
      icon: <FiClock />,
      color: "blitz",
      controls: [
        { label: "3+0", time: "3+0", description: "3 minutes" },
        { label: "3+2", time: "3+2", description: "3 min + 2 sec" },
        { label: "5+0", time: "5+0", description: "5 minutes" },
        { label: "5+3", time: "5+3", description: "5 min + 3 sec" },
        { label: "4+2", time: "4+2", description: "4 min + 2 sec" },
      ],
    },
    {
      name: "⏳ Rapid",
      icon: <FiTarget />,
      color: "rapid",
      controls: [
        { label: "10+0", time: "10+0", description: "10 minutes" },
        { label: "10+5", time: "10+5", description: "10 min + 5 sec" },
        { label: "15+10", time: "15+10", description: "15 min + 10 sec" },
        { label: "15+0", time: "15+0", description: "15 minutes" },
        { label: "25+10", time: "25+10", description: "25 min + 10 sec" },
      ],
    },
    {
      name: "🕰 Classical",
      icon: <FiShield />,
      color: "classical",
      controls: [
        { label: "90+30", time: "90+30", description: "1.5 hrs + 30 sec" },
        { label: "60+0", time: "60+0", description: "1 hour" },
        { label: "60+30", time: "60+30", description: "1 hr + 30 sec" },
        { label: "120+30", time: "120+30", description: "2 hrs + 30 sec" },
        {
          label: "90/40+30",
          time: "90/40+30",
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

export default TimeControlModal;
