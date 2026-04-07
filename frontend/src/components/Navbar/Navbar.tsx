import React, { useState, useEffect } from "react";
import "./Navbar.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthProvider";
import { getAllNotifications, type NotificationDto } from "../../api/notifications";
import NotificationCenter from "../NotificationCenter/NotificationCenter";
import Crown from "../../assets/Crown.png";
import { FiBell, FiSun, FiMoon } from "react-icons/fi";
import { useTheme } from "../../context/ThemeProvider";
import { getMyRating, displayRating } from "../../api/ratings";

interface NavbarProps {
  rating: number;
  streak: number;
}

const Navbar: React.FC<NavbarProps> = ({ rating, streak }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { theme, toggleTheme } = useTheme();
  const [glickoRating, setGlickoRating] = useState<number>(rating);

  useEffect(() => {
    loadUnreadCount();
  }, []);

  useEffect(() => {
    getMyRating()
      .then((r) => setGlickoRating(displayRating(r.data.glickoRating)))
      .catch(() => {});
  }, []);

  const loadUnreadCount = async () => {
    try {
      const response = await getAllNotifications();
      const count = (response.data || []).filter((n) => !n.isRead).length;
      setUnreadCount(count);
    } catch (err) {
      console.error("Failed to load unread count:", err);
    }
  };

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
            <a href="/profile" className="nav-link">
              <span className="nav-icon">👤</span>
              Profile
            </a>
            <a href="/rankings" className="nav-link">
              <span className="nav-icon">🏆</span>
              Rankings
            </a>
            <a href="/game-history" className="nav-link">
              <span className="nav-icon">📜</span>
              History
            </a>
            <a href="/settings" className="nav-link">
              <span className="nav-icon">⚙️</span>
              Settings
            </a>
          </div>

          {/* Stats + Notifications + Theme + Logout */}
          <div className="nav-stats">
            <div className="streak-badge">
              <span className="streak-icon">🔥</span>
              <span className="streak-text">{streak} Win Streak</span>
            </div>

            <div className="rating-badge">Rating: {glickoRating}</div>

            {/* Notification Bell */}
            <div className="notification-bell">
              <button
                className="bell-btn"
                onClick={() => setNotificationCenterOpen(!notificationCenterOpen)}
                title="Notifications"
              >
                <FiBell />
                {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
              </button>
            </div>

            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <FiSun /> : <FiMoon />}
            </button>

            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Notification Center Sidebar */}
      <NotificationCenter
        isOpen={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
      />
    </>
  );
};

export default Navbar;