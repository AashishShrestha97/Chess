import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import Navbar from "../components/Navbar/Navbar";
import "./SettingsPage.css";
import {
  FiUser,
  FiEye,
  FiPlay,
  FiMic,
  FiSun,
  FiShield,
  FiSave,
  FiRotateCcw,
  FiDownload,
  FiTrash2,
  FiLock,
  FiMail,
  FiPhone,
  FiCheck,
  FiX,
} from "react-icons/fi";
import deepgramVoiceCommandService from "../utils/deepgramVoiceCommandService";
import deepgramTTSService from "../utils/deepgramTTSService";

type SettingsTab =
  | "account"
  | "accessibility"
  | "game"
  | "voice"
  | "theme"
  | "privacy";

interface UserSettings {
  // Account
  displayName: string;
  username: string;
  email: string;
  phone: string;

  // Accessibility
  highContrast: boolean;
  largeText: boolean;
  screenReader: boolean;
  reduceMotion: boolean;

  // Game
  boardOrientation: "white" | "black";
  pieceSet: "standard" | "neo" | "wood" | "marble";
  showLegalMoves: boolean;
  autoQueen: boolean;
  soundEffects: boolean;
  moveConfirmation: boolean;

  // Voice
  voiceEnabled: boolean;
  voiceLanguage: string;
  voiceRate: number;
  voiceVolume: number;
  ttsVoice: string;

  // Theme
  theme: "dark" | "light" | "system";
  accentColor: string;
  boardTheme: "brown" | "blue" | "green" | "gray";

  // Privacy
  showOnlineStatus: boolean;
  allowFriendRequests: boolean;
  showGameHistory: boolean;
  dataSharing: boolean;
}

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Password change modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Delete account modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [settings, setSettings] = useState<UserSettings>({
    // Account
    displayName: user?.name || "Chess Player",
    username: user?.email?.split("@")[0] || "player123",
    email: user?.email || "",
    phone: user?.phone || "",

    // Accessibility
    highContrast: false,
    largeText: false,
    screenReader: false,
    reduceMotion: false,

    // Game
    boardOrientation: "white",
    pieceSet: "standard",
    showLegalMoves: true,
    autoQueen: true,
    soundEffects: true,
    moveConfirmation: false,

    // Voice
    voiceEnabled: true,
    voiceLanguage: "en-IN",
    voiceRate: 1.0,
    voiceVolume: 0.8,
    ttsVoice: "default",

    // Theme
    theme: "dark",
    accentColor: "#ffd700",
    boardTheme: "brown",

    // Privacy
    showOnlineStatus: true,
    allowFriendRequests: true,
    showGameHistory: true,
    dataSharing: false,
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("userSettings");
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings((prev) => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to load settings:", e);
      }
    }
  }, []);

  // Track changes
  const handleSettingChange = <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSaveSuccess(false);
  };

  // Save settings
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage
      localStorage.setItem("userSettings", JSON.stringify(settings));

      // Apply voice settings
      if (settings.voiceEnabled) {
        deepgramVoiceCommandService.setVoiceEnabled(true);
      } else {
        deepgramVoiceCommandService.setVoiceEnabled(false);
      }

      // Apply sound settings
      deepgramTTSService.setSoundEnabled(settings.soundEffects);

      // Apply theme
      document.documentElement.setAttribute("data-theme", settings.theme);
      document.documentElement.style.setProperty(
        "--accent-color",
        settings.accentColor
      );

      // Apply accessibility settings
      if (settings.highContrast) {
        document.body.classList.add("high-contrast");
      } else {
        document.body.classList.remove("high-contrast");
      }

      if (settings.largeText) {
        document.body.classList.add("large-text");
      } else {
        document.body.classList.remove("large-text");
      }

      if (settings.reduceMotion) {
        document.body.classList.add("reduce-motion");
      } else {
        document.body.classList.remove("reduce-motion");
      }

      await new Promise((resolve) => setTimeout(resolve, 800));

      setHasChanges(false);
      setSaveSuccess(true);

      // Speak confirmation
      if (settings.voiceEnabled) {
        await deepgramTTSService.speak({
          text: "Settings saved successfully",
          rate: 1.1,
        });
      }

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to defaults
  const handleReset = () => {
    if (
      window.confirm(
        "Are you sure you want to reset all settings to default values?"
      )
    ) {
      localStorage.removeItem("userSettings");
      window.location.reload();
    }
  };

  // Change password
  const handleChangePassword = async () => {
    setPasswordError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    try {
      // TODO: Implement actual password change API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      alert("Password changed successfully!");
      setShowPasswordModal(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError("Failed to change password. Please try again.");
    }
  };

  // Export data
  const handleExportData = async () => {
    try {
      const data = {
        user: {
          name: user?.name,
          email: user?.email,
        },
        settings: settings,
        exportDate: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chess4everyone-data-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert("Data exported successfully!");
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export data");
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      alert('Please type "DELETE" to confirm');
      return;
    }

    try {
      // TODO: Implement actual account deletion API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await logout();
      navigate("/");
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete account");
    }
  };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case "account":
        return (
          <div className="settings-content">
            <div className="settings-section">
              <h3 className="section-title">Account Information</h3>
              <p className="section-subtitle">
                Manage your personal information and account preferences
              </p>

              <div className="settings-grid">
                <div className="setting-item">
                  <label className="setting-label">
                    <FiUser className="label-icon" />
                    Display Name
                  </label>
                  <input
                    type="text"
                    className="setting-input"
                    value={settings.displayName}
                    onChange={(e) =>
                      handleSettingChange("displayName", e.target.value)
                    }
                    placeholder="Enter your display name"
                  />
                </div>

                <div className="setting-item">
                  <label className="setting-label">
                    <FiUser className="label-icon" />
                    Username
                  </label>
                  <input
                    type="text"
                    className="setting-input"
                    value={settings.username}
                    onChange={(e) =>
                      handleSettingChange("username", e.target.value)
                    }
                    placeholder="Enter your username"
                  />
                </div>

                <div className="setting-item">
                  <label className="setting-label">
                    <FiMail className="label-icon" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="setting-input"
                    value={settings.email}
                    disabled
                    placeholder="your@email.com"
                  />
                  <span className="setting-hint">Email cannot be changed</span>
                </div>

                <div className="setting-item">
                  <label className="setting-label">
                    <FiPhone className="label-icon" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    className="setting-input"
                    value={settings.phone}
                    onChange={(e) =>
                      handleSettingChange("phone", e.target.value)
                    }
                    placeholder="Enter your phone number"
                  />
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h3 className="section-title">Account Actions</h3>

              <div className="action-buttons">
                <button
                  className="action-btn"
                  onClick={() => setShowPasswordModal(true)}
                >
                  <FiLock />
                  Change Password
                </button>

                <button className="action-btn" onClick={handleExportData}>
                  <FiDownload />
                  Export Data
                </button>

                <button
                  className="action-btn danger"
                  onClick={() => setShowDeleteModal(true)}
                >
                  <FiTrash2 />
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        );

      case "accessibility":
        return (
          <div className="settings-content">
            <div className="settings-section">
              <h3 className="section-title">Accessibility Options</h3>
              <p className="section-subtitle">
                Customize the interface to meet your accessibility needs
              </p>

              <div className="settings-list">
                <div className="setting-row">
                  <div className="setting-info">
                    <h4>High Contrast Mode</h4>
                    <p>Increase contrast for better visibility</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.highContrast}
                      onChange={(e) =>
                        handleSettingChange("highContrast", e.target.checked)
                      }
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Large Text</h4>
                    <p>Increase font size throughout the application</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.largeText}
                      onChange={(e) =>
                        handleSettingChange("largeText", e.target.checked)
                      }
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Screen Reader Support</h4>
                    <p>Enable enhanced support for screen readers</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.screenReader}
                      onChange={(e) =>
                        handleSettingChange("screenReader", e.target.checked)
                      }
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Reduce Motion</h4>
                    <p>Minimize animations and transitions</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.reduceMotion}
                      onChange={(e) =>
                        handleSettingChange("reduceMotion", e.target.checked)
                      }
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        );

      case "game":
        return (
          <div className="settings-content">
            <div className="settings-section">
              <h3 className="section-title">Game Preferences</h3>
              <p className="section-subtitle">
                Customize your chess playing experience
              </p>

              <div className="settings-grid">
                <div className="setting-item">
                  <label className="setting-label">Board Orientation</label>
                  <select
                    className="setting-select"
                    value={settings.boardOrientation}
                    onChange={(e) =>
                      handleSettingChange(
                        "boardOrientation",
                        e.target.value as "white" | "black"
                      )
                    }
                  >
                    <option value="white">White on Bottom</option>
                    <option value="black">Black on Bottom</option>
                  </select>
                </div>

                <div className="setting-item">
                  <label className="setting-label">Piece Set</label>
                  <select
                    className="setting-select"
                    value={settings.pieceSet}
                    onChange={(e) =>
                      handleSettingChange("pieceSet", e.target.value as any)
                    }
                  >
                    <option value="standard">Standard</option>
                    <option value="neo">Neo</option>
                    <option value="wood">Wood</option>
                    <option value="marble">Marble</option>
                  </select>
                </div>

                <div className="setting-item">
                  <label className="setting-label">Board Theme</label>
                  <select
                    className="setting-select"
                    value={settings.boardTheme}
                    onChange={(e) =>
                      handleSettingChange("boardTheme", e.target.value as any)
                    }
                  >
                    <option value="brown">Brown</option>
                    <option value="blue">Blue</option>
                    <option value="green">Green</option>
                    <option value="gray">Gray</option>
                  </select>
                </div>
              </div>

              <div className="settings-list" style={{ marginTop: "2rem" }}>
                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Show Legal Moves</h4>
                    <p>Highlight possible moves when a piece is selected</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.showLegalMoves}
                      onChange={(e) =>
                        handleSettingChange("showLegalMoves", e.target.checked)
                      }
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Auto-Queen Promotion</h4>
                    <p>Automatically promote pawns to queens</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.autoQueen}
                      onChange={(e) =>
                        handleSettingChange("autoQueen", e.target.checked)
                      }
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Sound Effects</h4>
                    <p>Play sounds for moves and game events</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.soundEffects}
                      onChange={(e) =>
                        handleSettingChange("soundEffects", e.target.checked)
                      }
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Move Confirmation</h4>
                    <p>Require confirmation before making a move</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.moveConfirmation}
                      onChange={(e) =>
                        handleSettingChange(
                          "moveConfirmation",
                          e.target.checked
                        )
                      }
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        );

      case "voice":
        return (
          <div className="settings-content">
            <div className="settings-section">
              <h3 className="section-title">Voice Settings</h3>
              <p className="section-subtitle">
                Configure voice commands and text-to-speech
              </p>

              <div className="settings-list">
                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Voice Commands Enabled</h4>
                    <p>Enable voice control for gameplay</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.voiceEnabled}
                      onChange={(e) =>
                        handleSettingChange("voiceEnabled", e.target.checked)
                      }
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className="settings-grid" style={{ marginTop: "2rem" }}>
                <div className="setting-item">
                  <label className="setting-label">Voice Language</label>
                  <select
                    className="setting-select"
                    value={settings.voiceLanguage}
                    onChange={(e) =>
                      handleSettingChange("voiceLanguage", e.target.value)
                    }
                    disabled={!settings.voiceEnabled}
                  >
                    <option value="en-US">English (US)</option>
                    <option value="en-GB">English (UK)</option>
                    <option value="en-IN">English (India)</option>
                    <option value="en-AU">English (Australia)</option>
                  </select>
                </div>

                <div className="setting-item">
                  <label className="setting-label">TTS Voice</label>
                  <select
                    className="setting-select"
                    value={settings.ttsVoice}
                    onChange={(e) =>
                      handleSettingChange("ttsVoice", e.target.value)
                    }
                    disabled={!settings.voiceEnabled}
                  >
                    <option value="default">Default</option>
                    <option value="male">Male Voice</option>
                    <option value="female">Female Voice</option>
                  </select>
                </div>

                <div className="setting-item">
                  <label className="setting-label">
                    Speech Rate: {settings.voiceRate.toFixed(1)}x
                  </label>
                  <input
                    type="range"
                    className="setting-range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={settings.voiceRate}
                    onChange={(e) =>
                      handleSettingChange(
                        "voiceRate",
                        parseFloat(e.target.value)
                      )
                    }
                    disabled={!settings.voiceEnabled}
                  />
                  <div className="range-labels">
                    <span>Slow</span>
                    <span>Normal</span>
                    <span>Fast</span>
                  </div>
                </div>

                <div className="setting-item">
                  <label className="setting-label">
                    Speech Volume: {Math.round(settings.voiceVolume * 100)}%
                  </label>
                  <input
                    type="range"
                    className="setting-range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.voiceVolume}
                    onChange={(e) =>
                      handleSettingChange(
                        "voiceVolume",
                        parseFloat(e.target.value)
                      )
                    }
                    disabled={!settings.voiceEnabled}
                  />
                  <div className="range-labels">
                    <span>Quiet</span>
                    <span>Medium</span>
                    <span>Loud</span>
                  </div>
                </div>
              </div>

              {settings.voiceEnabled && (
                <button
                  className="test-voice-btn"
                  onClick={async () => {
                    await deepgramTTSService.speak({
                      text: "This is a test of the text to speech system. Knight to F3.",
                      rate: settings.voiceRate,
                      volume: settings.voiceVolume,
                    });
                  }}
                >
                  🔊 Test Voice Settings
                </button>
              )}
            </div>
          </div>
        );

      case "theme":
        return (
          <div className="settings-content">
            <div className="settings-section">
              <h3 className="section-title">Appearance</h3>
              <p className="section-subtitle">
                Customize the look and feel of the application
              </p>

              <div className="settings-grid">
                <div className="setting-item">
                  <label className="setting-label">Theme Mode</label>
                  <select
                    className="setting-select"
                    value={settings.theme}
                    onChange={(e) =>
                      handleSettingChange("theme", e.target.value as any)
                    }
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="system">System Default</option>
                  </select>
                </div>

                <div className="setting-item">
                  <label className="setting-label">Accent Color</label>
                  <div className="color-picker">
                    <input
                      type="color"
                      className="color-input"
                      value={settings.accentColor}
                      onChange={(e) =>
                        handleSettingChange("accentColor", e.target.value)
                      }
                    />
                    <span className="color-value">{settings.accentColor}</span>
                  </div>
                </div>
              </div>

              <div className="theme-preview">
                <h4>Preview</h4>
                <div
                  className="preview-box"
                  style={{
                    borderColor: settings.accentColor,
                  }}
                >
                  <div className="preview-header">
                    <span
                      className="preview-accent"
                      style={{ color: settings.accentColor }}
                    >
                      Chess4Everyone
                    </span>
                  </div>
                  <div className="preview-content">
                    <button
                      className="preview-button"
                      style={{ background: settings.accentColor }}
                    >
                      Sample Button
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "privacy":
        return (
          <div className="settings-content">
            <div className="settings-section">
              <h3 className="section-title">Privacy & Data</h3>
              <p className="section-subtitle">
                Control your privacy and data sharing preferences
              </p>

              <div className="settings-list">
                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Show Online Status</h4>
                    <p>Let others see when you're online</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.showOnlineStatus}
                      onChange={(e) =>
                        handleSettingChange(
                          "showOnlineStatus",
                          e.target.checked
                        )
                      }
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Allow Friend Requests</h4>
                    <p>Enable other players to send you friend requests</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.allowFriendRequests}
                      onChange={(e) =>
                        handleSettingChange(
                          "allowFriendRequests",
                          e.target.checked
                        )
                      }
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Public Game History</h4>
                    <p>Allow others to view your game history</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.showGameHistory}
                      onChange={(e) =>
                        handleSettingChange("showGameHistory", e.target.checked)
                      }
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Analytics & Data Sharing</h4>
                    <p>Help us improve by sharing anonymous usage data</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.dataSharing}
                      onChange={(e) =>
                        handleSettingChange("dataSharing", e.target.checked)
                      }
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Navbar rating={1847} streak={5} />

      <div className="settings-page">
        <div className="settings-container">
          {/* Header */}
          <header className="settings-header">
            <div className="header-content">
              <h1 className="page-title">⚙️ Settings</h1>
              <p className="page-subtitle">
                Customize your Chess4Everyone experience
              </p>
            </div>

            {/* Action Buttons */}
            <div className="header-actions">
              {hasChanges && (
                <button
                  className="header-btn save-btn"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <div className="spinner" />
                      Saving...
                    </>
                  ) : saveSuccess ? (
                    <>
                      <FiCheck />
                      Saved!
                    </>
                  ) : (
                    <>
                      <FiSave />
                      Save Changes
                    </>
                  )}
                </button>
              )}

              <button className="header-btn reset-btn" onClick={handleReset}>
                <FiRotateCcw />
                Reset All
              </button>
            </div>
          </header>

          {/* Tabs */}
          <div className="settings-tabs">
            <button
              className={`tab-btn ${activeTab === "account" ? "active" : ""}`}
              onClick={() => setActiveTab("account")}
            >
              <FiUser />
              <span>Account</span>
            </button>

            <button
              className={`tab-btn ${
                activeTab === "accessibility" ? "active" : ""
              }`}
              onClick={() => setActiveTab("accessibility")}
            >
              <FiEye />
              <span>Accessibility</span>
            </button>

            <button
              className={`tab-btn ${activeTab === "game" ? "active" : ""}`}
              onClick={() => setActiveTab("game")}
            >
              <FiPlay />
              <span>Game</span>
            </button>

            <button
              className={`tab-btn ${activeTab === "voice" ? "active" : ""}`}
              onClick={() => setActiveTab("voice")}
            >
              <FiMic />
              <span>Voice</span>
            </button>

            <button
              className={`tab-btn ${activeTab === "theme" ? "active" : ""}`}
              onClick={() => setActiveTab("theme")}
            >
              <FiSun />
              <span>Theme</span>
            </button>

            <button
              className={`tab-btn ${activeTab === "privacy" ? "active" : ""}`}
              onClick={() => setActiveTab("privacy")}
            >
              <FiShield />
              <span>Privacy</span>
            </button>
          </div>

          {/* Content */}
          <div className="settings-body">{renderTabContent()}</div>
        </div>

        {/* Password Change Modal */}
        {showPasswordModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowPasswordModal(false)}
          >
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Change Password</h3>
                <button
                  className="modal-close"
                  onClick={() => setShowPasswordModal(false)}
                >
                  <FiX />
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label>Current Password</label>
                  <input
                    type="password"
                    className="modal-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>

                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    className="modal-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>

                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    className="modal-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>

                {passwordError && (
                  <div className="error-message">{passwordError}</div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  className="modal-btn secondary"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="modal-btn primary"
                  onClick={handleChangePassword}
                >
                  Change Password
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Account Modal */}
        {showDeleteModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowDeleteModal(false)}
          >
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Delete Account</h3>
                <button
                  className="modal-close"
                  onClick={() => setShowDeleteModal(false)}
                >
                  <FiX />
                </button>
              </div>

              <div className="modal-body">
                <div className="warning-box">
                  <strong>⚠️ Warning</strong>
                  <p>
                    This action is permanent and cannot be undone. All your
                    data, game history, and settings will be permanently
                    deleted.
                  </p>
                </div>

                <div className="form-group">
                  <label>
                    Type <strong>DELETE</strong> to confirm
                  </label>
                  <input
                    type="text"
                    className="modal-input"
                    value={deleteConfirmText}
                    onChange={(e) =>
                      setDeleteConfirmText(e.target.value.toUpperCase())
                    }
                    placeholder="DELETE"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="modal-btn secondary"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="modal-btn danger"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== "DELETE"}
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SettingsPage;
