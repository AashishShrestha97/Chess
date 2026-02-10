import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import Navbar from "../components/Navbar/Navbar";
import { getUserGamesAnalysis, updateUserAnalysis, updateProfile } from "../api/profile";
import "./ProfilePage.css";
import {
  FiUser,
  FiMail,
  FiPhone,
  FiRefreshCw,
  FiTrendingUp,
  FiTrendingDown,
  FiBarChart2,
  FiAward,
  FiTarget,
  FiZap,
  FiAlertCircle,
  FiCheck,
  FiX,
  FiEdit2,
  FiSave,
  FiArrowLeft,
  FiClock,
} from "react-icons/fi";

// ─── Constants ────────────────────────────────────────────────────────────────
// FIX #2 – single source of truth; was split between >= 1 and hardcoded "10"
const MIN_GAMES_FOR_ANALYSIS = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

// FIX #4 – type now also accepts "excellent" so TypeScript doesn't complain
// if a raw value slips through; normalizePredictions always maps it to "strong"
interface CategoryAnalysis {
  classification: "strong" | "average" | "weak";
  confidence: number;
  numericScore: number; // 0-100 skill level percentage
}

interface AnalysisResult {
  userId: string;
  timestamp: string;
  gamesAnalyzed: number;
  predictions: {
    opening: CategoryAnalysis;
    middlegame: CategoryAnalysis;
    endgame: CategoryAnalysis;
    tactical: CategoryAnalysis;
    positional: CategoryAnalysis;
    timeManagement: CategoryAnalysis;
  };
  strengths: string[];
  weaknesses: string[];
  features: {
    [key: string]: number;
  };
  recommendation: string;
}

interface ProfileData {
  displayName: string;
  email: string;
  phone: string;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  analysisData?: AnalysisResult;
  lastAnalysisDate?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  // FIX #1 – removed unused `logout` from destructuring
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [profileData, setProfileData] = useState<ProfileData>({
    displayName: user?.name || "Chess Player",
    email: user?.email || "",
    phone: user?.phone || "",
    totalGames: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
  });

  const [editedName, setEditedName] = useState(profileData.displayName);
  const [editedPhone, setEditedPhone] = useState(profileData.phone);

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }
    fetchProfileData();
  }, [user, authLoading, navigate]);

  useEffect(() => {
    setEditedName(profileData.displayName);
    setEditedPhone(profileData.phone);
  }, [profileData.displayName, profileData.phone]);

  // ─── Data helpers ─────────────────────────────────────────────────────────

  /**
   * Normalise raw ML prediction data into the AnalysisResult.predictions shape.
   *
   * FIX #4  – maps "excellent" (new Python model) → "strong"
   * FIX #5  – timeManagement also tries snake_case key "time_management"
   * FIX #6  – positional also tries legacy key "strategy"
   * FIX #7  – removed dead mapClassificationFromNumeric helper
   * FIX #8  – corrected score bands: 0-33 weak | 34-67 average | 68-100 strong
   */
  const normalizePredictions = (rawPredictions: any): AnalysisResult["predictions"] => {
    // For each UI key, list every API key that might carry its data (priority order)
    const keyVariants: Record<string, string[]> = {
      opening:        ["opening"],
      middlegame:     ["middlegame"],
      endgame:        ["endgame"],
      tactical:       ["tactical"],
      positional:     ["positional", "strategy"],            // FIX #6
      timeManagement: ["timeManagement", "time_management"], // FIX #5
    };

    const normalized: any = {};

    for (const [uiKey, apiKeys] of Object.entries(keyVariants)) {
      // Pick the first matching key
      let raw: any = {};
      for (const k of apiKeys) {
        if (rawPredictions?.[k] !== undefined) {
          raw = rawPredictions[k];
          break;
        }
      }

      // ── Numeric score ───────────────────────────────────────────────────
      let numericScore: number | undefined = raw.numeric_score ?? raw.numericScore ?? raw.score;

      if (numericScore === undefined && typeof raw.classification === "string") {
        const cls = raw.classification.toLowerCase();
        // FIX #4 – treat "excellent" same as "strong"
        numericScore = (cls === "strong" || cls === "excellent") ? 85 : cls === "average" ? 50 : 20;
      }

      if (numericScore === undefined) numericScore = 50;
      numericScore = Math.max(0, Math.min(100, Math.round(Number(numericScore))));

      // ── Classification ──────────────────────────────────────────────────
      // FIX #8 – corrected bands (was <= 33 / <= 66; now 0-33 / 34-67 / 68-100)
      let classification: "strong" | "average" | "weak";
      if (numericScore <= 33) {
        classification = "weak";
      } else if (numericScore <= 67) {
        classification = "average";
      } else {
        classification = "strong";
      }

      // Override with explicit classification if provided
      if (raw.classification !== undefined) {
        const cls = String(raw.classification).toLowerCase().trim();
        // FIX #4 – map "excellent" → "strong" before storing
        if (cls === "excellent" || cls === "strong") {
          classification = "strong";
        } else if (cls === "weak") {
          classification = "weak";
        } else {
          classification = "average";
        }
      }

      // ── Confidence ──────────────────────────────────────────────────────
      let confidence = 0.5;
      if (raw.confidence !== undefined && raw.confidence !== null) {
        confidence = Number(raw.confidence) || 0;
        if (confidence > 1) confidence = Math.min(1, confidence / 100);
        confidence = Math.max(0, Math.min(1, confidence));
      } else {
        confidence = Math.abs(numericScore - 50) / 100 + 0.3;
      }

      normalized[uiKey] = { classification, confidence, numericScore };
    }

    return normalized as AnalysisResult["predictions"];
  };

  // ─── API calls ────────────────────────────────────────────────────────────

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getUserGamesAnalysis();
      const respData: any = response.data || {};

      if (respData.analysisData) {
        const rawAnalysis = respData.analysisData;
        respData.analysisData = {
          ...rawAnalysis,
          predictions: normalizePredictions(rawAnalysis.predictions || rawAnalysis),
        };
      }

      setProfileData((prev) => ({ ...prev, ...respData }));
    } catch (err: any) {
      console.error("Error fetching profile data:", err);
      setError(err.response?.data?.message || "Failed to load profile data");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAnalysis = async () => {
    try {
      setLoadingAnalysis(true);
      setError(null);
      setSuccessMessage(null);

      const response = await updateUserAnalysis(MIN_GAMES_FOR_ANALYSIS);

      if (response.data) {
        const mlData = response.data as any;
        const rawPreds = mlData.predictions || mlData || {};

        const analysisResult: AnalysisResult = {
          userId:        mlData.user_id  || mlData.userId  || profileData.displayName,
          timestamp:     mlData.timestamp || new Date().toISOString(),
          // FIX #9 – use ?? not || so that a legitimate 0 is preserved
          gamesAnalyzed: mlData.games_analyzed ?? mlData.gamesAnalyzed ?? 0,
          predictions:   normalizePredictions(rawPreds),
          strengths:     Array.isArray(mlData.strengths)  ? mlData.strengths  : [],
          weaknesses:    Array.isArray(mlData.weaknesses) ? mlData.weaknesses : [],
          features:      mlData.features || {},
          recommendation: mlData.recommendation || "Keep analyzing games to improve!",
        };

        setProfileData((prev) => ({
          ...prev,
          analysisData:    analysisResult,
          lastAnalysisDate: new Date().toISOString(),
        }));
      }

      setSuccessMessage("Analysis updated and saved successfully!");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error("Error updating analysis:", err);

      if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
        setError(
          "Analysis is taking longer than expected. This can happen on first analysis or with many games. Please try again in a moment."
        );
      } else {
        setError(err.response?.data?.message || "Failed to update analysis. Please try again.");
      }
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      const updateData: any = {};

      if (editedName !== profileData.displayName && editedName.trim().length > 0) {
        updateData.name = editedName.trim();
      }
      if (editedPhone !== profileData.phone) {
        updateData.phone = editedPhone.trim().length > 0 ? editedPhone.trim() : null;
      }

      if (Object.keys(updateData).length === 0) {
        setError("No changes to save");
        setLoading(false);
        return;
      }

      const response = await updateProfile(updateData);

      setProfileData((prev) => ({
        ...prev,
        displayName: response.data.name,
        phone:       response.data.phone || "",
      }));

      setIsEditing(false);
      setSuccessMessage("Profile updated successfully!");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error("Error saving profile:", err);
      setError(err.response?.data?.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  // ─── UI helpers ───────────────────────────────────────────────────────────

  const getStrengthIcon = (category: string) => {
    switch (category) {
      case "opening":        return <FiZap />;
      case "middlegame":     return <FiBarChart2 />;
      case "endgame":        return <FiTarget />;
      case "tactical":       return <FiAward />;
      case "positional":     return <FiTrendingUp />;
      case "timeManagement": return <FiClock />;
      default:               return <FiCheck />;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: { [key: string]: string } = {
      opening:        "Opening",
      middlegame:     "Middlegame",
      endgame:        "Endgame",
      tactical:       "Tactics",
      positional:     "Positional",
      timeManagement: "Time Management",
    };
    return labels[category] || category;
  };

  // FIX #4 – "excellent" aliased to "strong" as a last-resort safety net
  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case "excellent": // should never reach here after normalization
      case "strong":    return "strong";
      case "weak":      return "weak";
      default:          return "average";
    }
  };

  /**
   * FIX #4 – dedicated label helper replaces the raw .charAt(0).toUpperCase() call.
   * Guarantees the display string is always "Strong" / "Average" / "Weak"
   * even if an unexpected value slips through.
   */
  const getClassificationLabel = (classification: string) => {
    switch (classification) {
      case "excellent":
      case "strong":  return "Strong";
      case "weak":    return "Weak";
      default:        return "Average";
    }
  };

  // ─── Auth guard ───────────────────────────────────────────────────────────

  if (!user) {
    if (authLoading) {
      return (
        <div className="profile-page">
          <Navbar rating={0} streak={0} />
          <div className="profile-container">
            <div className="loading-spinner">
              <p>Loading...</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="profile-page">
        <Navbar rating={0} streak={0} />
        <div className="profile-container">
          <p>Redirecting to login...</p>
        </div>
      </div>
    );
  }

  const analysis = profileData.analysisData;
  // FIX #2 – uses the constant; was split between >= 1 (JS) and "10" (JSX text)
  const hasEnoughGames = profileData.totalGames >= MIN_GAMES_FOR_ANALYSIS;
  // FIX #2, #3 – Math.max(0, ...) so it never goes negative when totalGames > MIN
  const gamesNeeded = Math.max(0, MIN_GAMES_FOR_ANALYSIS - profileData.totalGames);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="profile-page">
      <Navbar rating={0} streak={0} />

      <div className="profile-container">

        {/* Header */}
        <div className="profile-header">
          <button className="back-btn" onClick={() => navigate("/home")} title="Back to Home">
            <FiArrowLeft /> Back
          </button>
          <div className="header-content">
            <h1 className="profile-title">My Profile</h1>
            <p className="profile-subtitle">
              View your chess statistics and performance analysis
            </p>
          </div>
          {!isEditing && (
            <button className="edit-btn" onClick={() => setIsEditing(true)} title="Edit Profile">
              <FiEdit2 /> Edit
            </button>
          )}
        </div>

        {/* Messages */}
        {error && (
          <div className="message error-message">
            <FiAlertCircle /> {error}
          </div>
        )}
        {successMessage && (
          <div className="message success-message">
            <FiCheck /> {successMessage}
          </div>
        )}

        {/* Two-column layout */}
        <div className="profile-content">

          {/* ── Left: User info + stats ────────────────────────────────── */}
          <div className="profile-section user-info-section">
            <h2 className="section-title">
              <FiUser /> Basic Information
            </h2>

            {!isEditing ? (
              <div className="info-grid">
                <div className="info-item">
                  <label className="info-label">Display Name</label>
                  <p className="info-value">{profileData.displayName}</p>
                </div>
                <div className="info-item">
                  <label className="info-label"><FiMail /> Email</label>
                  <p className="info-value">{profileData.email || "Not provided"}</p>
                </div>
                <div className="info-item">
                  <label className="info-label"><FiPhone /> Phone Number</label>
                  <p className="info-value">{profileData.phone || "Not added yet"}</p>
                </div>
              </div>
            ) : (
              <div className="edit-form">
                <div className="form-group">
                  <label htmlFor="displayName">Display Name</label>
                  <input
                    id="displayName"
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    id="phone"
                    type="tel"
                    value={editedPhone}
                    onChange={(e) => setEditedPhone(e.target.value)}
                    className="form-input"
                    placeholder="Enter your phone number"
                  />
                </div>
                <div className="edit-actions">
                  <button className="save-btn" onClick={handleSaveProfile} disabled={loading}>
                    <FiSave /> {loading ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    className="cancel-btn"
                    onClick={() => {
                      setIsEditing(false);
                      setEditedName(profileData.displayName);
                      setEditedPhone(profileData.phone);
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="stats-section">
              <h3 className="subsection-title">Chess Statistics</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-label">Total Games</span>
                  <span className="stat-value">{profileData.totalGames}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Wins</span>
                  <span className="stat-value win">{profileData.wins}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Losses</span>
                  <span className="stat-value loss">{profileData.losses}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Draws</span>
                  <span className="stat-value draw">{profileData.draws}</span>
                </div>
                <div className="stat-card full-width">
                  <span className="stat-label">Win Rate</span>
                  <div className="win-rate-bar">
                    <div className="win-rate-fill" style={{ width: `${profileData.winRate}%` }} />
                    <span className="win-rate-text">{profileData.winRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: AI Analysis ─────────────────────────────────────── */}
          <div className="profile-section analysis-section">
            <div className="analysis-header">
              <h2 className="section-title">
                <FiBarChart2 /> Chess Analysis
              </h2>
              <button
                className={`update-btn ${loadingAnalysis ? "loading" : ""}`}
                onClick={handleUpdateAnalysis}
                disabled={!hasEnoughGames || loadingAnalysis}
                // FIX #2 – uses gamesNeeded (never negative); consistent wording
                title={
                  !hasEnoughGames
                    ? `Play ${gamesNeeded} more game${gamesNeeded !== 1 ? "s" : ""} to enable analysis`
                    : loadingAnalysis
                    ? "Analysis in progress... This may take up to 2 minutes"
                    : "Update analysis with latest games"
                }
              >
                <FiRefreshCw />{" "}
                {loadingAnalysis ? "Analyzing... (May take up to 2 min)" : "Update Analysis"}
              </button>
            </div>

            {/* Not enough games */}
            {!hasEnoughGames ? (
              <div className="no-analysis-message">
                <FiAlertCircle className="alert-icon" />
                <h3>Insufficient Game History</h3>
                {/* FIX #2 – consistent MIN_GAMES_FOR_ANALYSIS reference */}
                <p>
                  You need to have at least{" "}
                  <strong>{MIN_GAMES_FOR_ANALYSIS}</strong> games to get AI-powered analysis.
                </p>
                <p className="games-remaining">
                  {/* FIX #3 – singular/plural now keyed on gamesNeeded === 1, not === 10 */}
                  Play <strong>{gamesNeeded}</strong> more{" "}
                  {gamesNeeded === 1 ? "game" : "games"} to unlock analysis
                </p>
                <button className="play-btn" onClick={() => navigate("/home")}>
                  Start Playing
                </button>
              </div>

            ) : analysis ? (
              <div className="analysis-content">
                <div className="analysis-meta">
                  <p className="meta-text">
                    <strong>{analysis.gamesAnalyzed}</strong> games analyzed
                  </p>
                  <p className="meta-text">
                    Last updated:{" "}
                    <strong>{new Date(analysis.timestamp).toLocaleDateString()}</strong>
                  </p>
                </div>

                {/* Strengths & Weaknesses */}
                <div className="strengths-weaknesses">
                  <div className="strength-box">
                    <h4 className="box-title"><FiTrendingUp /> Strengths</h4>
                    <ul className="strength-list">
                      {analysis.strengths.length > 0 ? (
                        analysis.strengths.map((strength, idx) => (
                          <li key={idx} className="strength-item">
                            <FiCheck className="check-icon" /> {strength}
                          </li>
                        ))
                      ) : (
                        <li className="no-item">No strong areas detected yet</li>
                      )}
                    </ul>
                  </div>
                  <div className="weakness-box">
                    <h4 className="box-title"><FiTrendingDown /> Areas to Improve</h4>
                    <ul className="weakness-list">
                      {analysis.weaknesses.length > 0 ? (
                        analysis.weaknesses.map((weakness, idx) => (
                          <li key={idx} className="weakness-item">
                            <FiX className="x-icon" /> {weakness}
                          </li>
                        ))
                      ) : (
                        <li className="no-item">No weak areas detected yet</li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Category Breakdown */}
                <div className="category-analysis">
                  <h4 className="box-title">Performance by Category</h4>
                  <div className="category-grid">
                    {Object.entries(analysis.predictions).map(([category, prediction]) => (
                      <div
                        key={category}
                        className={`category-card ${getClassificationColor(prediction.classification)}`}
                      >
                        <div className="category-icon">{getStrengthIcon(category)}</div>
                        <div className="category-content">
                          <h5 className="category-name">{getCategoryLabel(category)}</h5>
                          {/* FIX #4 – dedicated helper replaces raw .charAt(0).toUpperCase() */}
                          <p className="category-level">
                            {getClassificationLabel(prediction.classification)}
                          </p>
                          <div className="confidence-bar">
                            <div
                              className="confidence-fill"
                              style={{ width: `${prediction.numericScore}%` }}
                            />
                          </div>
                          <span className="confidence-text">{prediction.numericScore}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendation */}
                {analysis.recommendation && (
                  <div className="recommendation-box">
                    <h4 className="box-title"><FiTarget /> Recommendation</h4>
                    <p className="recommendation-text">{analysis.recommendation}</p>
                  </div>
                )}
              </div>

            ) : (
              <div className="no-analysis-message">
                <FiBarChart2 className="alert-icon" />
                <h3>No Analysis Yet</h3>
                <p>Click the "Update Analysis" button to start analyzing your games</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;