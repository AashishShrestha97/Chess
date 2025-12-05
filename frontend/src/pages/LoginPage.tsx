import React, { useEffect } from "react";
import "./LoginPage.css";
import LoginLeft from "../components/Auth/Login/LoginLeft";
import LoginForm from "../components/Auth/Login/LoginForm";

const LoginPage: React.FC = () => {
  // enable fade-up on scroll and mount
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach(
          (e) => e.isIntersecting && e.target.classList.add("visible")
        ),
      { threshold: 0.2 }
    );
    document.querySelectorAll(".fade-up").forEach((el) => obs.observe(el));
  }, []);

  return (
    <div className="login-wrap">
      <div className="login-grid">
        <LoginLeft />
        <LoginForm />
      </div>
    </div>
  );
};

export default LoginPage;
