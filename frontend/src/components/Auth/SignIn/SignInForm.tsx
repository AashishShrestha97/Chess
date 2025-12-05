import React, { useState } from "react";
import "./SignInForm.css";
import { FiMail, FiLock, FiUser, FiPhone } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import { Link, useNavigate } from "react-router-dom";
import { googleUrl, registerApi } from "../../../api/auth";

const SignInForm: React.FC = () => {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await registerApi({ name, phone, email, password, confirmPassword });
      navigate("/login");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Sign up failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="form-side">
      <div className="form-card fade-up">
        <h2 className="title">Sign In</h2>
        <p className="subtitle">Enter your details to create your account</p>

        <a className="btn-google" href={googleUrl()}>
          <span className="google-icon">
            <FcGoogle />
          </span>
          <span>Continue with Google</span>
        </a>

        <div className="divider">
          <span className="line" />
          <span className="text">OR CONTINUE WITH EMAIL</span>
          <span className="line" />
        </div>

        <form className="form" onSubmit={onSubmit}>
          <label className="label">Name</label>
          <div className="field">
            <FiUser />
            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <label className="label">Phone no.</label>
          <div className="field">
            <FiPhone />
            <input
              type="tel"
              placeholder="Enter your number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <label className="label">Email</label>
          <div className="field">
            <FiMail />
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <label className="label">Password</label>
          <div className="field">
            <FiLock />
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <label className="label">Confirm Password</label>
          <div className="field">
            <FiLock />
            <input
              type="password"
              placeholder="Enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div style={{ color: "#ff7a7a", marginTop: "-.3rem" }}>{error}</div>
          )}

          <button type="submit" className="btn-submit" disabled={submitting}>
            {submitting ? "Creating..." : "Sign In"}
          </button>
        </form>

        <p className="footnote">
          Already have an account? <Link to="/login">Log In</Link>
        </p>
      </div>
    </section>
  );
};

export default SignInForm;
