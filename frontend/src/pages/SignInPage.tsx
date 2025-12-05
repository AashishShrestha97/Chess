import React, { useEffect } from "react";
import "./SignInPage.css";
import SignInLeft from "../components/Auth/SignIn/SignInLeft";
import SignInForm from "../components/Auth/SignIn/SignInForm";

const SignInPage: React.FC = () => {
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
    <div className="signin-wrap">
      <div className="signin-grid">
        <SignInLeft />
        <SignInForm />
      </div>
    </div>
  );
};

export default SignInPage;
