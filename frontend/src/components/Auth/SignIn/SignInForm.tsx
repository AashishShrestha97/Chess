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
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    
    console.log("📝 Registration attempt for:", email);
    
    try {
      const response = await registerApi({ 
        name, 
        phone, 
        email, 
        password, 
        confirmPassword 
      });
      
      console.log("✅ Registration response:", response.data);
      
      setSuccess(true);
      
      // Wait 2 seconds then redirect to login
      setTimeout(() => {
        navigate("/login");
      }, 2000);
      
    } catch (err: any) {
      console.error("❌ Registration error:", err);
      
      const errorMessage = err?.response?.data?.message || 
                          err?.response?.data?.error ||
                          "Registration failed. Please try again.";
      
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="form-side">
      <div className="form-card fade-up">
        <h2 className="title">Sign Up</h2>
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
              placeholder="At least 8 characters, 1 uppercase, 1 number, 1 special char"
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
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div style={{ 
              color: "#ff7a7a", 
              marginTop: "-.3rem",
              padding: "12px",
              background: "rgba(255, 122, 122, 0.1)",
              borderRadius: "8px",
              fontSize: "0.9rem",
              lineHeight: "1.5"
            }}>
              {error}
            </div>
          )}
          
          {success && (
            <div style={{ 
              color: "#5ad45a", 
              marginTop: "-.3rem",
              padding: "12px",
              background: "rgba(90, 212, 90, 0.1)",
              borderRadius: "8px",
              fontSize: "0.9rem"
            }}>
              ✅ Registration successful! Redirecting to login...
            </div>
          )}

          <button type="submit" className="btn-submit" disabled={submitting || success}>
            {submitting ? "Creating Account..." : success ? "Success!" : "Sign Up"}
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