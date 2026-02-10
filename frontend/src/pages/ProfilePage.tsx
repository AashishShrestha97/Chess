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

// Types for AI Analysis
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

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, logout } = useAuth();

  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);

  // Profile data
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

  // Editable fields
  const [editedName, setEditedName] = useState(profileData.displayName);
  const [editedPhone, setEditedPhone] = useState(profileData.phone);

  // Load profile data on mount
  useEffect(() => {
    // Wait for auth to finish loading before redirecting
    if (authLoading) {
      return;
    }
    
    if (!user) {
      navigate("/login");
      return;
    }

    fetchProfileData();
  }, [user, authLoading, navigate]);

  // Update editable fields when profile data changes
  useEffect(() => {
    setEditedName(profileData.displayName);
    setEditedPhone(profileData.phone);
  }, [profileData.displayName, profileData.phone]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get user's games analysis
      const response = await getUserGamesAnalysis();
      // Normalize analysis predictions if present
      const respData: any = response.data || {};
      if (respData.analysisData) {
        const rawAnalysis = respData.analysisData;
        const normalizedPreds = normalizePredictions(rawAnalysis.predictions || rawAnalysis);
        respData.analysisData = {
          ...rawAnalysis,
          predictions: normalizedPreds,
        };
      }

      setProfileData((prev) => ({
        ...prev,
        ...respData,
      }));
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

      // Call backend to update analysis (which will call ML service and save to DB)
      // Request analysis over the 10 most recent games
      const response = await updateUserAnalysis(10);
      
      // Transform MLAnalysisResponse to AnalysisResult format
      if (response.data) {
        const mlData = response.data as any;
        
        // Normalize predictions returned by ML service (handles various field names/formats)
        const rawPreds = mlData.predictions || mlData || {};
        const normalizedPreds = normalizePredictions(rawPreds);

        const analysisResult: AnalysisResult = {
          userId: mlData.user_id || mlData.userId || profileData.displayName,
          timestamp: mlData.timestamp || new Date().toISOString(),
          gamesAnalyzed: mlData.games_analyzed || mlData.gamesAnalyzed || 0,
          predictions: normalizedPreds,
          strengths: mlData.strengths || [],
          weaknesses: mlData.weaknesses || [],
          features: mlData.features || {},
          recommendation: mlData.recommendation || "Keep analyzing games to improve!",
        };

        setProfileData((prev) => ({
          ...prev,
          analysisData: analysisResult,
          lastAnalysisDate: new Date().toISOString(),
        }));
      }

      setSuccessMessage("Analysis updated and saved successfully!");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error("Error updating analysis:", err);
      
      // Handle timeout errors specifically
      if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
        setError(
          "Analysis is taking longer than expected. This can happen on first analysis or with many games. Please try again in a moment."
        );
      } else {
        setError(
          err.response?.data?.message ||
            "Failed to update analysis. Please try again."
        );
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
      
      // Only include name if it has changed
      if (editedName !== profileData.displayName && editedName.trim().length > 0) {
        updateData.name = editedName.trim();
      }
      
      // Only include phone if it has changed
      if (editedPhone !== profileData.phone) {
        // Send null if phone is empty, otherwise send the phone number
        updateData.phone = editedPhone.trim().length > 0 ? editedPhone.trim() : null;
      }

      console.log("💾 Saving profile with:", updateData);

      // Validate that at least something changed
      if (Object.keys(updateData).length === 0) {
        setError("No changes to save");
        setLoading(false);
        return;
      }

      // Update profile in database
      const response = await updateProfile(updateData);

      console.log("✅ Profile update response:", response.data);

      setProfileData((prev) => ({
        ...prev,
        displayName: response.data.name,
        phone: response.data.phone || "",
      }));

      setIsEditing(false);
      setSuccessMessage("Profile updated successfully!");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error("❌ Error saving profile:", err);
      setError(err.response?.data?.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const getStrengthIcon = (category: string) => {
    switch (category) {
      case "opening":
        return <FiZap />;
      case "middlegame":
        return <FiBarChart2 />;
      case "endgame":
        return <FiTarget />;
      case "tactical":
        return <FiAward />;
      case "positional":
        return <FiTrendingUp />;
      case "timeManagement":
        return <FiClock />;
      default:
        return <FiCheck />;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: { [key: string]: string } = {
      opening: "Opening",
      middlegame: "Middlegame",
      endgame: "Endgame",
      tactical: "Tactics",
      positional: "Positional",
      timeManagement: "Time Management",
    };
    return labels[category] || category;
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case "strong":
        return "strong";
      case "average":
        return "average";
      case "weak":
        return "weak";
      default:
        return "average";
    }
  };

  // Normalize raw ML prediction data into the AnalysisResult.predictions shape
  const normalizePredictions = (rawPredictions: any) => {
    const categories = [
      "opening",
      "middlegame",
      "endgame",
      "tactical",
      "positional",
      "timeManagement",
    ];

    const mapClassificationFromNumeric = (n: number) => (n === 2 ? "strong" : n === 1 ? "average" : "weak");

    const normalized: any = {};

    for (const cat of categories) {
      const raw = rawPredictions?.[cat] ?? rawPredictions?.[cat.toLowerCase()] ?? {};

      // numeric score may come in different fields/names
      let numericScore: number | undefined = raw.numeric_score ?? raw.numericScore ?? raw.score;

      // If numeric score is absent but classification exists, derive numericScore from classification
      if (numericScore === undefined && typeof raw.classification === "string") {
        numericScore = raw.classification === "strong" ? 85 : raw.classification === "average" ? 50 : 20;
      }

      // Default to 50 (average) when nothing present
      if (numericScore === undefined) numericScore = 50;

      // Clamp to 0-100
      numericScore = Math.max(0, Math.min(100, numericScore));

      // Derive classification from numeric_score (0-33=weak, 34-66=average, 67-100=strong)
      let classification: string;
      if (numericScore <= 33) {
        classification = "weak";
      } else if (numericScore <= 66) {
        classification = "average";
      } else {
        classification = "strong";
      }

      // Override if explicit classification provided
      if (raw.classification !== undefined) {
        classification = (raw.classification as any);
      }

      // Confidence: prefer explicit value; normalize if given as 0-100
      let confidence: number | null = null;
      if (raw.confidence !== undefined && raw.confidence !== null) {
        confidence = Number(raw.confidence) || 0;
        if (confidence > 1) confidence = Math.min(1, confidence / 100);
        confidence = Math.max(0, Math.min(1, confidence));
      } else {
        // Derive confidence from numeric_score (lower -> less confident, higher -> more confident)
        confidence = Math.abs(numericScore - 50) / 100 + 0.3; // Range ~0.3-0.8
      }

      normalized[cat] = {
        classification,
        confidence,
        numericScore: Math.round(numericScore),
      };
    }

    return normalized as AnalysisResult["predictions"];
  };

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
  // Require at least 1 past game to perform analysis (per new requirement)
  const hasEnoughGames = profileData.totalGames >= 1;

  return (
    <div className="profile-page">
      <Navbar rating={0} streak={0} />

      <div className="profile-container">
        {/* Header Section */}
        <div className="profile-header">
          <button
            className="back-btn"
            onClick={() => navigate("/home")}
            title="Back to Home"
          >
            <FiArrowLeft /> Back
          </button>

          <div className="header-content">
            <h1 className="profile-title">My Profile</h1>
            <p className="profile-subtitle">
              View your chess statistics and performance analysis
            </p>
          </div>

          {!isEditing && (
            <button
              className="edit-btn"
              onClick={() => setIsEditing(true)}
              title="Edit Profile"
            >
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

        {/* Main Content - Two Column Layout */}
        <div className="profile-content">
          {/* Left Column - User Info */}
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
                  <label className="info-label">
                    <FiMail /> Email
                  </label>
                  <p className="info-value">{profileData.email || "Not provided"}</p>
                </div>

                <div className="info-item">
                  <label className="info-label">
                    <FiPhone /> Phone Number
                  </label>
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
                  <button
                    className="save-btn"
                    onClick={handleSaveProfile}
                    disabled={loading}
                  >
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

            {/* Stats Section */}
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
                    <div
                      className="win-rate-fill"
                      style={{ width: `${profileData.winRate}%` }}
                    />
                    <span className="win-rate-text">
                      {profileData.winRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - AI Analysis */}
          <div className="profile-section analysis-section">
            <div className="analysis-header">
              <h2 className="section-title">
                <FiBarChart2 /> Chess Analysis
              </h2>
              <button
                className={`update-btn ${loadingAnalysis ? "loading" : ""}`}
                onClick={handleUpdateAnalysis}
                disabled={!hasEnoughGames || loadingAnalysis}
                title={
                  !hasEnoughGames
                    ? `Play ${10 - profileData.totalGames} more game to enable analysis`
                    : loadingAnalysis
                    ? "Analysis in progress... This may take up to 2 minutes"
                    : "Update analysis with latest games"
                }
              >
                <FiRefreshCw /> {loadingAnalysis ? "Analyzing... (May take up to 2 min)" : "Update Analysis"}
              </button>
            </div>

            {!hasEnoughGames ? (
              <div className="no-analysis-message">
                <FiAlertCircle className="alert-icon" />
                <h3>Insufficient Game History</h3>
                <p>
                  You need to have at least 10 past game to get AI-powered analysis.
                </p>
                <p className="games-remaining">
                  Play <strong>{10 - profileData.totalGames}</strong> more{" "}
                  {10 - profileData.totalGames === 10 ? "game" : "games"} to unlock analysis
                </p>
                <button
                  className="play-btn"
                  onClick={() => navigate("/home")}
                >
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
                    <strong>
                      {new Date(analysis.timestamp).toLocaleDateString()}
                    </strong>
                  </p>
                </div>

                {/* Strengths and Weaknesses */}
                <div className="strengths-weaknesses">
                  <div className="strength-box">
                    <h4 className="box-title">
                      <FiTrendingUp /> Strengths
                    </h4>
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
                    <h4 className="box-title">
                      <FiTrendingDown /> Areas to Improve
                    </h4>
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
                    {Object.entries(analysis.predictions).map(
                      ([category, prediction]) => (
                        <div
                          key={category}
                          className={`category-card ${getClassificationColor(
                            prediction.classification
                          )}`}
                        >
                          <div className="category-icon">
                            {getStrengthIcon(category)}
                          </div>
                          <div className="category-content">
                            <h5 className="category-name">
                              {getCategoryLabel(category)}
                            </h5>
                            <p className="category-level">
                              {prediction.classification.charAt(0).toUpperCase() +
                                prediction.classification.slice(1)}
                            </p>
                            <div className="confidence-bar">
                              <div
                                className="confidence-fill"
                                style={{
                                  width: `${prediction.numericScore}%`,
                                }}
                              />
                            </div>
                            <span className="confidence-text">
                              {prediction.numericScore}%
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Recommendation */}
                {analysis.recommendation && (
                  <div className="recommendation-box">
                    <h4 className="box-title">
                      <FiTarget /> Recommendation
                    </h4>
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