import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginForm.css";
import { FiMail, FiLock, FiChevronRight } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import { googleUrl, loginApi, meApi } from "../../../api/auth";
import { useAuth } from "../../../context/AuthProvider";

const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    
    console.log("🔐 Login attempt for:", email);
    
    try {
      const response = await loginApi(email, password);
      console.log("✅ Login response:", response.data);
      
      // Get user data
      const { data } = await meApi();
      console.log("✅ User data:", data);
      
      setUser(data);
      navigate("/home");
    } catch (err: any) {
      console.error("❌ Login error:", err);
      
      const errorMessage = err?.response?.data?.message || 
                          err?.response?.data?.error ||
                          "Login failed. Please check your credentials.";
      
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="form-side">
      <div className="form-card fade-up">
        <h2 className="title">Log In</h2>
        <p className="subtitle">
          Enter your credentials to access <span>your account</span>
        </p>

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

          {error && (
            <div style={{ 
              color: "#ff7a7a", 
              marginTop: "-.5rem",
              padding: "12px",
              background: "rgba(255, 122, 122, 0.1)",
              borderRadius: "8px",
              fontSize: "0.9rem"
            }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn-submit" disabled={submitting}>
            {submitting ? (
              "Logging In..."
            ) : (
              <>
                Log In <FiChevronRight />
              </>
            )}
          </button>
        </form>

        <p className="footnote">
          Don't have an account?{" "}
          <button onClick={() => navigate("/signin")} className="link-button">
            Sign up
          </button>
        </p>
      </div>
    </section>
  );
};

export default LoginForm;