import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthProvider";
import {
  FiUsers,
  FiMic,
  FiSettings,
  FiArrowLeft,
  FiLogOut,
  FiMenu,
  FiX,
  FiHome,
} from "react-icons/fi";
import Logo from "../../assets/Logo.png";
import "./AdminSidebar.css";

interface AdminSidebarProps {
  onTabChange?: (tabId: string) => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ onTabChange }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: FiHome,
    },
    {
      id: "users",
      label: "User Management",
      icon: FiUsers,
    },
    {
      id: "voice-commands",
      label: "Voice Commands",
      icon: FiMic,
    },
    {
      id: "game-modes",
      label: "Game Modes",
      icon: FiSettings,
    },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleMenuItemClick = (itemId: string) => {
    if (itemId === "dashboard") {
      // Dashboard is the default view, just close the sidebar
      setIsOpen(false);
    } else {
      // Call the parent callback to change the tab
      onTabChange?.(itemId);
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Sidebar */}
      <aside className={`admin-sidebar ${isOpen ? "open" : ""}`}>
        {/* Logo Section */}
        <div className="sidebar-logo">
          <img src={Logo} alt="Chess4Everyone" className="logo-image" />
          <h2 className="logo-text">Admin</h2>
          <button
            className="sidebar-close"
            onClick={() => setIsOpen(false)}
          >
            <FiX />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="sidebar-nav">
          <div className="nav-section">
            <p className="nav-section-title">Management</p>
            <ul className="nav-list">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id} className="nav-item">
                    <button
                      className="nav-item-link"
                      onClick={() => handleMenuItemClick(item.id)}
                    >
                      <Icon className="nav-item-icon" />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className="sidebar-bottom">
          <button
            className="sidebar-action logout"
            onClick={handleLogout}
            title="Logout"
          >
            <FiLogOut />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {isOpen && (
        <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />
      )}

      {/* Toggle Button */}
      <button className="sidebar-toggle" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <FiX /> : <FiMenu />}
      </button>
    </>
  );
};

export default AdminSidebar;
