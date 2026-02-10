import React, { useState, useEffect } from "react";
import "./Navbar.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthProvider";
import { getAllNotifications, type NotificationDto } from "../../api/notifications";
import NotificationCenter from "../NotificationCenter/NotificationCenter";
import Crown from "../../assets/Crown.png";
import { FiBell } from "react-icons/fi";

interface NavbarProps {
  rating: number;
  streak: number;
}

const Navbar: React.FC<NavbarProps> = ({ rating, streak }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Load unread count on mount
    loadUnreadCount();
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
              Game History
            </a>
            <a href="/settings" className="nav-link">
              <span className="nav-icon">⚙️</span>
              Settings
            </a>
          </div>

          {/* Stats + Notifications + Accessibility + Logout */}
          <div className="nav-stats">
            <div className="streak-badge">
              <span className="streak-icon">🔥</span>
              <span className="streak-text">{streak} Win Streak</span>
            </div>

            <div className="rating-badge">Rating: {rating}</div>
            
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

