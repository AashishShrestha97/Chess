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
  FiInfo,
} from "react-icons/fi";

// ─── Constants ────────────────────────────────────────────────────────────────
const MIN_GAMES_FOR_ANALYSIS = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryAnalysis {
  classification: "strong" | "average" | "weak";
  confidence: number;
  numericScore: number;
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
  features: { [key: string]: number };
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

/**
 * Structured error returned by the backend when there are not enough
 * complete games for ML analysis.
 */
interface NotEnoughGamesError {
  error: "NOT_ENOUGH_COMPLETE_GAMES";
  message: string;
  mlWorthyGames: number;
  totalGames: number;
  gamesNeeded: number;
  minimumRequired: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  /** Non-null when the backend says there aren't enough complete games. */
  const [notEnoughGamesInfo, setNotEnoughGamesInfo] =
    useState<NotEnoughGamesError | null>(null);

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

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }
    fetchProfileData();
  }, [user, authLoading, navigate]);

  useEffect(() => {
    setEditedName(profileData.displayName);
    setEditedPhone(profileData.phone);
  }, [profileData.displayName, profileData.phone]);

  // ─── Normalise ML predictions ─────────────────────────────────────────────

  const normalizePredictions = (rawPredictions: any): AnalysisResult["predictions"] => {
    const keyVariants: Record<string, string[]> = {
      opening:        ["opening"],
      middlegame:     ["middlegame"],
      endgame:        ["endgame"],
      tactical:       ["tactical"],
      positional:     ["positional", "strategy"],
      timeManagement: ["timeManagement", "time_management"],
    };

    const normalized: any = {};

    for (const [uiKey, apiKeys] of Object.entries(keyVariants)) {
      let raw: any = {};
      for (const k of apiKeys) {
        if (rawPredictions?.[k] !== undefined) { raw = rawPredictions[k]; break; }
      }

      let numericScore: number | undefined = raw.numeric_score ?? raw.numericScore ?? raw.score;
      if (numericScore === undefined && typeof raw.classification === "string") {
        const cls = raw.classification.toLowerCase();
        numericScore = (cls === "strong" || cls === "excellent") ? 85 : cls === "average" ? 50 : 20;
      }
      if (numericScore === undefined) numericScore = 50;
      numericScore = Math.max(0, Math.min(100, Math.round(Number(numericScore))));

      let classification: "strong" | "average" | "weak";
      if (numericScore <= 33)      classification = "weak";
      else if (numericScore <= 67) classification = "average";
      else                         classification = "strong";

      if (raw.classification !== undefined) {
        const cls = String(raw.classification).toLowerCase().trim();
        if (cls === "excellent" || cls === "strong") classification = "strong";
        else if (cls === "weak")                     classification = "weak";
        else                                          classification = "average";
      }

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
      setNotEnoughGamesInfo(null);

      const response = await updateUserAnalysis(MIN_GAMES_FOR_ANALYSIS);

      if (response.data) {
        const mlData = response.data as any;
        const rawPreds = mlData.predictions || mlData || {};

        const analysisResult: AnalysisResult = {
          userId:         mlData.user_id  || mlData.userId  || profileData.displayName,
          timestamp:      mlData.timestamp || new Date().toISOString(),
          gamesAnalyzed:  mlData.games_analyzed ?? mlData.gamesAnalyzed ?? 0,
          predictions:    normalizePredictions(rawPreds),
          strengths:      Array.isArray(mlData.strengths)  ? mlData.strengths  : [],
          weaknesses:     Array.isArray(mlData.weaknesses) ? mlData.weaknesses : [],
          features:       mlData.features || {},
          recommendation: mlData.recommendation || "Keep analyzing games to improve!",
        };

        setProfileData((prev) => ({
          ...prev,
          analysisData:     analysisResult,
          lastAnalysisDate: new Date().toISOString(),
        }));
      }

      setSuccessMessage("Analysis updated and saved successfully!");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error("Error updating analysis:", err);

      // ── Structured "not enough games" error from backend ─────────────────
      const responseData = err.response?.data;

      if (
        err.response?.status === 400 &&
        responseData?.error === "NOT_ENOUGH_COMPLETE_GAMES"
      ) {
        // Show the friendly card instead of a generic error message
        setNotEnoughGamesInfo(responseData as NotEnoughGamesError);
        return;
      }

      // ── Timeout ────────────────────────────────────────────────────────────
      if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
        setError(
          "Analysis is taking longer than expected. This can happen on first run. Please try again."
        );
        return;
      }

      // ── Generic error ─────────────────────────────────────────────────────
      setError(responseData?.message || "Failed to update analysis. Please try again.");
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
      if (editedName !== profileData.displayName && editedName.trim().length > 0)
        updateData.name = editedName.trim();
      if (editedPhone !== profileData.phone)
        updateData.phone = editedPhone.trim().length > 0 ? editedPhone.trim() : null;

      if (Object.keys(updateData).length === 0) {
        setError("No changes to save"); setLoading(false); return;
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
    const labels: Record<string, string> = {
      opening:        "Opening",
      middlegame:     "Middlegame",
      endgame:        "Endgame",
      tactical:       "Tactics",
      positional:     "Positional",
      timeManagement: "Time Management",
    };
    return labels[category] || category;
  };

  const getClassificationColor = (classification: string) => {
    if (classification === "excellent" || classification === "strong") return "strong";
    if (classification === "weak") return "weak";
    return "average";
  };

  const getClassificationLabel = (classification: string) => {
    if (classification === "excellent" || classification === "strong") return "Strong";
    if (classification === "weak") return "Weak";
    return "Average";
  };

  // ─── Auth guard ───────────────────────────────────────────────────────────

  if (!user) {
    if (authLoading) {
      return (
        <div className="profile-page">
          <Navbar rating={0} streak={0} />
          <div className="profile-container">
            <div className="loading-spinner"><p>Loading...</p></div>
          </div>
        </div>
      );
    }
    return (
      <div className="profile-page">
        <Navbar rating={0} streak={0} />
        <div className="profile-container"><p>Redirecting to login...</p></div>
      </div>
    );
  }

  const analysis = profileData.analysisData;
  const hasEnoughGames = profileData.totalGames >= MIN_GAMES_FOR_ANALYSIS;
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
            <p className="profile-subtitle">View your chess statistics and performance analysis</p>
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

          {/* ── Left: User info + stats ──────────────────────────────── */}
          <div className="profile-section user-info-section">
            <h2 className="section-title"><FiUser /> Basic Information</h2>

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
                  <input id="displayName" type="text" value={editedName}
                    onChange={(e) => setEditedName(e.target.value)} className="form-input" />
                </div>
                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <input id="phone" type="tel" value={editedPhone}
                    onChange={(e) => setEditedPhone(e.target.value)}
                    className="form-input" placeholder="Enter your phone number" />
                </div>
                <div className="edit-actions">
                  <button className="save-btn" onClick={handleSaveProfile} disabled={loading}>
                    <FiSave /> {loading ? "Saving..." : "Save Changes"}
                  </button>
                  <button className="cancel-btn"
                    onClick={() => {
                      setIsEditing(false);
                      setEditedName(profileData.displayName);
                      setEditedPhone(profileData.phone);
                    }} disabled={loading}>
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

          {/* ── Right: AI Analysis ──────────────────────────────────── */}
          <div className="profile-section analysis-section">
            <div className="analysis-header">
              <h2 className="section-title"><FiBarChart2 /> Chess Analysis</h2>
              <button
                className={`update-btn ${loadingAnalysis ? "loading" : ""}`}
                onClick={handleUpdateAnalysis}
                disabled={!hasEnoughGames || loadingAnalysis}
                title={
                  !hasEnoughGames
                    ? `Play ${gamesNeeded} more game${gamesNeeded !== 1 ? "s" : ""} to enable analysis`
                    : loadingAnalysis
                    ? "Analysis in progress... This may take up to 2 minutes"
                    : "Update analysis with latest games"
                }
              >
                <FiRefreshCw />{" "}
                {loadingAnalysis ? "Analyzing... (up to 2 min)" : "Update Analysis"}
              </button>
            </div>

            {/* ── Not enough total games (first-time) ─────────────────── */}
            {!hasEnoughGames ? (
              <div className="no-analysis-message">
                <FiAlertCircle className="alert-icon" />
                <h3>Insufficient Game History</h3>
                <p>
                  You need at least <strong>{MIN_GAMES_FOR_ANALYSIS}</strong> games to get
                  AI-powered analysis.
                </p>
                <p className="games-remaining">
                  Play <strong>{gamesNeeded}</strong> more{" "}
                  {gamesNeeded === 1 ? "game" : "games"} to unlock analysis
                </p>
                <button className="play-btn" onClick={() => navigate("/home")}>
                  Start Playing
                </button>
              </div>

            ) : /* ── Not enough COMPLETE games ────────────────────────────── */
            notEnoughGamesInfo ? (
              <NotEnoughCompleteGamesCard
                info={notEnoughGamesInfo}
                onPlayNow={() => navigate("/home")}
                onDismiss={() => setNotEnoughGamesInfo(null)}
              />

            ) : analysis ? (
              /* ── Analysis results ──────────────────────────────────────── */
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
                        analysis.strengths.map((s, i) => (
                          <li key={i} className="strength-item">
                            <FiCheck className="check-icon" /> {s}
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
                        analysis.weaknesses.map((w, i) => (
                          <li key={i} className="weakness-item">
                            <FiX className="x-icon" /> {w}
                          </li>
                        ))
                      ) : (
                        <li className="no-item">No weak areas detected yet</li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Category breakdown */}
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
              /* ── No analysis yet ───────────────────────────────────────── */
              <div className="no-analysis-message">
                <FiBarChart2 className="alert-icon" />
                <h3>No Analysis Yet</h3>
                <p>Click "Update Analysis" to start analyzing your games</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── NotEnoughCompleteGamesCard ───────────────────────────────────────────────

interface NotEnoughCompleteGamesCardProps {
  info: NotEnoughGamesError;
  onPlayNow: () => void;
  onDismiss: () => void;
}

const NotEnoughCompleteGamesCard: React.FC<NotEnoughCompleteGamesCardProps> = ({
  info,
  onPlayNow,
  onDismiss,
}) => {
  const { mlWorthyGames, totalGames, gamesNeeded, minimumRequired } = info;
  const shortGames = totalGames - mlWorthyGames;

  return (
    <div className="no-analysis-message" style={{ textAlign: "left" }}>
      {/* Icon + title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <FiInfo
          style={{
            fontSize: 28,
            color: "#ffd700",
            flexShrink: 0,
            background: "rgba(255,215,0,0.12)",
            borderRadius: "50%",
            padding: 4,
          }}
        />
        <h3 style={{ margin: 0, fontSize: "1.05rem" }}>
          Not Enough Complete Games
        </h3>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.82rem",
            color: "#aaa",
            marginBottom: 6,
          }}
        >
          <span>Complete games</span>
          <span>
            <strong style={{ color: "#ffd700" }}>{mlWorthyGames}</strong> / {minimumRequired}
          </span>
        </div>
        <div
          style={{
            height: 8,
            borderRadius: 4,
            background: "rgba(255,255,255,0.1)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 4,
              width: `${Math.min(100, (mlWorthyGames / minimumRequired) * 100)}%`,
              background: "linear-gradient(90deg, #ffd700, #ffaa00)",
              transition: "width 0.5s ease",
            }}
          />
        </div>
      </div>

      {/* What counts / doesn't count */}
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          borderRadius: 10,
          padding: "12px 14px",
          marginBottom: 14,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <p style={{ margin: "0 0 8px", fontSize: "0.88rem", color: "#e0e0e0" }}>
          You need{" "}
          <strong style={{ color: "#ffd700" }}>
            {gamesNeeded} more complete game{gamesNeeded !== 1 ? "s" : ""}
          </strong>{" "}
          for AI analysis.
        </p>

        {shortGames > 0 && (
          <p
            style={{
              margin: 0,
              fontSize: "0.82rem",
              color: "#999",
              lineHeight: 1.5,
            }}
          >
            ⚠️{" "}
            <strong style={{ color: "#ffcc44" }}>
              {shortGames} game{shortGames !== 1 ? "s were" : " was"}
            </strong>{" "}
            too short to count — games must have at least{" "}
            <strong style={{ color: "#ffcc44" }}>10 moves</strong>. Quick resigns
            and disconnects don't qualify.
          </p>
        )}
      </div>

      {/* Tip */}
      <div
        style={{
          background: "rgba(100,200,100,0.06)",
          borderRadius: 8,
          padding: "10px 12px",
          marginBottom: 16,
          border: "1px solid rgba(100,200,100,0.15)",
          fontSize: "0.82rem",
          color: "#aaeaaa",
        }}
      >
        💡 <strong>Tip:</strong> Play longer games (Rapid or Classical) and try to play
        at least 10 moves before resigning — this ensures your games count towards
        analysis.
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          className="play-btn"
          onClick={onPlayNow}
          style={{ flex: 1 }}
        >
          Play a Game Now
        </button>
        <button
          onClick={onDismiss}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent",
            color: "#888",
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;