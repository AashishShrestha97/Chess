import React from "react";
import "./Navbar.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthProvider";
import Crown from "../../assets/Crown.png";

interface NavbarProps {
  rating: number;
  streak: number;
}

const Navbar: React.FC<NavbarProps> = ({ rating, streak }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <>
      <nav className="navbar">
        <div className="nav-container">
          {/* Brand */}
          <div className="nav-brand" onClick={() => navigate("/home")}>
            <img src={Crown} alt="Crown" className="crowns" />
            <span className="brand-name">Chess4Everyone</span>
          </div>

          {/* Links */}
          <div className="nav-links">
            <a href="/home" className="nav-link active">
              <span className="nav-icon">🏠</span>
              Home
            </a>
            <a href="/rankings" className="nav-link">
              <span className="nav-icon">🏆</span>
              Rankings
            </a>
            <a href="/profile" className="nav-link">
              <span className="nav-icon">👤</span>
              Profile
            </a>
            <a href="/settings" className="nav-link">
              <span className="nav-icon">⚙️</span>
              Settings
            </a>
          </div>

          {/* Stats + Accessibility + Logout */}
          <div className="nav-stats">
            <div className="streak-badge">
              <span className="streak-icon">🔥</span>
              <span className="streak-text">{streak} Win Streak</span>
            </div>

            <div className="rating-badge">Rating: {rating}</div>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
