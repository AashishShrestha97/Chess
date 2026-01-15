import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../components/admin/AdminSidebar";
import UserManagement from "../components/admin/UserManagement";
import VoiceCommandManagement from "../components/admin/VoiceCommandManagement";
import GameModeManagement from "../components/admin/GameModeManagement";
import {
  FiUsers,
  FiMic,
  FiSettings,
  FiShield,
} from "react-icons/fi";
import "./AdminPage.css";

type TabType = "users" | "voice-commands" | "game-modes";

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("users");

  const tabs = [
    {
      id: "users" as TabType,
      label: "User Management",
      icon: FiUsers,
    },
    {
      id: "voice-commands" as TabType,
      label: "Voice Commands",
      icon: FiMic,
    },
    {
      id: "game-modes" as TabType,
      label: "Game Modes",
      icon: FiSettings,
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "users":
        return <UserManagement />;
      case "voice-commands":
        return <VoiceCommandManagement />;
      case "game-modes":
        return <GameModeManagement />;
      default:
        return <UserManagement />;
    }
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as TabType);
  };

  return (
    <div className="admin-page">
      <AdminSidebar onTabChange={handleTabChange} />

      <div className="admin-container">
        {/* Header */}
        <div className="admin-header">
          <div className="header-content">
            <div className="title-section">
              <FiShield className="shield-icon" />
              <div className="title-text">
                <h1>Admin Dashboard</h1>
                <p>Manage users, game modes, and voice commands</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="admin-tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
              >
                <Icon />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="admin-content">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
