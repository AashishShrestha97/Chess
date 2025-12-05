import React from "react";
import "./LeaderboardPromo.css";

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

export default LeaderboardPromo;
