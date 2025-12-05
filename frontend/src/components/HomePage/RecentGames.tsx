import React from "react";
import "./RecentGames.css";

const rows = [
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

const RecentGames: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`panel recent ${className || ""}`}>
    <div className="rg-head">
      <h3>Recent Games</h3>
      <button className="btn-dark small">View All</button>
    </div>
    <div className="rg-list">
      {rows.map((r, i) => (
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

export default RecentGames;
