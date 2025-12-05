import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Header.css";
import { FiMic } from "react-icons/fi";
import Crown from "../../assets/Crown.png";
import HeroVideo from "../../assets/HeroVideo.mp4";

const Header: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach(
          (e) => e.isIntersecting && e.target.classList.add("visible")
        );
      },
      { threshold: 0.2 }
    );
    document.querySelectorAll(".fade-up").forEach((el) => obs.observe(el));
  }, []);

  return (
    <header className="hero">
      <div className="container hero-inner">
        <div className="crown fade-up">
          <img src={Crown} alt="Crown" />
        </div>
        <h1 className="hero-title fade-up">
          Chess<span className="accent">4</span>Everyone
        </h1>
        <p className="subtitle fade-up">Play Chess Anytime, With Your Voice</p>

        <div className="actions fade-up">
          <button
            className="btns btn-primarys"
            onClick={() => navigate("/login")} // Play Now → login
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 3l14 9-14 9V3z" />
            </svg>
            Play Now
          </button>

          <button
            className="btns btn-outlines"
            onClick={() => navigate("/signin")} // 👈 Sign In → SignUp page
          >
            Sign Up
          </button>
        </div>

        {/* Hero video */}
        <div className="hero-image fade-up">
          <video autoPlay loop muted playsInline className="hero-video">
            <source src={HeroVideo} type="video/mp4" />
            Your browser does not support the video tag.
          </video>

          {/* Voice Enabled pill */}
          <button className="voice-pill">
            <span className="pill-mic">
              <FiMic />
            </span>
            Voice Enabled
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
