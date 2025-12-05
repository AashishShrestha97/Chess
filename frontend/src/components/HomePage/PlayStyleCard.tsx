import React from "react";
import "./PlayStyleCard.css";

type Props = {
  variant: "voice" | "classic";
  badge?: string;
  bullets: string[];
  cta: string;
  onStart: () => void;
};

const PlayStyleCard: React.FC<Props> = ({
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

export default PlayStyleCard;
