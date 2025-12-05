import React, { useEffect, useRef } from "react";
import "./Modal.css";
import "./VersusModal.css";
import type { TimeControl } from "./TimeControlModal";
import { FiUsers, FiShuffle } from "react-icons/fi";

export type VersusChoice = "random" | "friends";

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (v: VersusChoice) => void;
  selectedTime: TimeControl | null;
  /** shown in the header: "Voice Chess" / "Classic Chess" */
  modeLabel?: string;
};

const VersusModal: React.FC<Props> = ({
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

export default VersusModal;
