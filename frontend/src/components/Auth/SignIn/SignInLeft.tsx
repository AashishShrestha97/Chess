import React from "react";
import "./SignInLeft.css";
import LogoRound from "../../../assets/Logo.png";

const SignInLeft: React.FC = () => {
  return (
    <aside className="left-panel">
      <div className="left-inner fade-up visible">
        <img className="brand-mark" src={LogoRound} alt="Chess4Everyone" />
        <h1 className="brand-title">
          Chess<span className="accent">4</span>Everyone
        </h1>
        <p className="brand-sub">Welcome back</p>
      </div>
    </aside>
  );
};

export default SignInLeft;
