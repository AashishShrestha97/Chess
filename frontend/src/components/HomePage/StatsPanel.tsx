import React from "react";
import "./StatsPanel.css";

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

export default StatsPanel;
