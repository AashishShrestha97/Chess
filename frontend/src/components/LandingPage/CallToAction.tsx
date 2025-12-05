import React from "react";
import "./CallToAction.css";
import { FiPlay } from "react-icons/fi";

const CallToAction: React.FC = () => {
  return (
    <section className="cta-section">
      <h2>Ready to Start Playing?</h2>
      <p>Join thousands of players experiencing the future of chess</p>
      <div className="cta-buttons">
        <button className="btn-primary">
          <FiPlay /> Get Started Free
        </button>
        <button className="btn-secondary">Watch Demo</button>
      </div>
    </section>
  );
};

export default CallToAction;
