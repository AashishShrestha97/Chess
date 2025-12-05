import React from "react";
import "./VoiceTip.css";

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

export default VoiceTip;
