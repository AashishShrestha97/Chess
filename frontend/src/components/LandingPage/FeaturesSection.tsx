import React from "react";
import FeatureCard from "./FeatureCard";
import "./FeaturesSection.css";
import { FiMic, FiCpu, FiUser, FiAward } from "react-icons/fi";

const FeaturesSection: React.FC = () => {
  return (
    <section className="features-section">
      <h2>Why Choose Chess4Everyone?</h2>
      <p className="subtitle">
        Experience chess like never before with cutting-edge technology and
        inclusive design.
      </p>
      <div className="features-grid">
        <FeatureCard
          icon={<FiMic />}
          title="Voice Commands"
          description="Play chess entirely with your voice. Perfect for accessibility and hands-free gaming."
        />
        <FeatureCard
          icon={<FiCpu />}
          title="AI Analysis"
          description="Get real-time AI-powered analysis of your moves and strategic recommendations."
        />
        <FeatureCard
          icon={<FiUser />}
          title="Inclusive Design"
          description="Built with accessibility in mind, ensuring chess is truly for everyone."
        />
        <FeatureCard
          icon={<FiAward />}
          title="Competitive Play"
          description="Join tournaments, climb leaderboards, and compete with players worldwide."
        />
      </div>
    </section>
  );
};

export default FeaturesSection;
