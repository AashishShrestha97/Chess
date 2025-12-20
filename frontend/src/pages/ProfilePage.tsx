import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import axios from "axios";
import Navbar from "../components/Navbar/Navbar";
import "./ProfilePage.css";

// Create axios instance with base configuration
const api = axios.create({
  baseURL: "http://localhost:8080",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Profile Stats Interface
export interface ProfileStats {
  userId: number;
  name: string;
  username: string;
  rating: number;
  ratingChangeThisMonth: number;
  globalRank: number;
  gamesPlayed: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  timePlayed: string;
  favoriteOpening: string;
  wins: number;
  draws: number;
  losses: number;
}

// Performance Area Interface
export interface PerformanceArea {
  name: string;
  score: number;
  change: number;
}

// Recent Game Interface
export interface RecentGame {
  id: number;
  opponentName: string;
  result: string;
  ratingChange: number;
  accuracyPercentage: number;
  timeAgo: string;
}

// API Functions
const getProfileStats = async () => {
  console.log("📡 API - Fetching profile stats");
  const response = await api.get<ProfileStats>("/api/profile/stats");
  console.log("✅ API - Profile stats received:", response.data);
  return response;
};

const getPerformanceAreas = async () => {
  console.log("📡 API - Fetching performance areas");
  const response = await api.get<PerformanceArea[]>("/api/profile/performance");
  console.log("✅ API - Performance areas received:", response.data);
  return response;
};

const getRecentGames = async () => {
  console.log("📡 API - Fetching recent games");
  const response = await api.get<RecentGame[]>("/api/profile/recent-games");
  console.log("✅ API - Recent games received:", response.data);
  return response;
};

// Combined fetch function for convenience
const getAllProfileData = async () => {
  console.log("📡 API - Fetching all profile data");
  const [statsRes, performanceRes, gamesRes] = await Promise.all([
    getProfileStats(),
    getPerformanceAreas(),
    getRecentGames(),
  ]);
  
  console.log("✅ API - All profile data received");
  
  return {
    stats: statsRes.data,
    performanceAreas: performanceRes.data,
    recentGames: gamesRes.data,
  };
};

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, refetchUser } = useAuth();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [performanceAreas, setPerformanceAreas] = useState<PerformanceArea[]>([]);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "games" | "ai-analysis">("overview");

  // Wait for auth to complete, then fetch profile
  useEffect(() => {
    console.log("👤 ProfilePage - State:", { 
      user: user ? `User(id=${user.id})` : "null", 
      authLoading 
    });
    
    if (authLoading) {
      console.log("⏳ ProfilePage - Still loading authentication...");
      return; // Wait for auth to complete
    }

    if (!user) {
      console.warn("⚠️ ProfilePage - User not authenticated, redirecting to login");
      setError("Please log in to view your profile");
      setTimeout(() => navigate("/login"), 1500);
      return;
    }

    // User is authenticated, fetch profile data
    console.log("✅ ProfilePage - User authenticated, fetching profile data");
    fetchProfileData();
  }, [authLoading, user, navigate]);

  const fetchProfileData = async () => {
    setError(null);
    setLoading(true);
    
    try {
      console.log("📡 ProfilePage - Starting profile data fetch");
      
      const { stats, performanceAreas, recentGames } = await getAllProfileData();
      
      console.log("✅ ProfilePage - All data received successfully");
      setStats(stats);
      setPerformanceAreas(performanceAreas);
      setRecentGames(recentGames);
      
    } catch (error: any) {
      console.error("❌ ProfilePage - Error fetching profile data");
      console.error("   Status:", error?.response?.status);
      console.error("   Message:", error?.message);
      
      // Handle authentication errors
      if (error?.response?.status === 401) {
        console.log("🔄 ProfilePage - Got 401, attempting to refresh user");
        
        if (refetchUser) {
          try {
            await refetchUser();
            console.log("✅ ProfilePage - User refreshed, retrying profile fetch");
            // Retry will happen automatically via useEffect when user updates
            return;
          } catch (refreshError) {
            console.error("❌ ProfilePage - Refresh failed, redirecting to login");
            setError("Session expired. Please log in again.");
            setTimeout(() => navigate("/login"), 2000);
            return;
          }
        }
        
        setError("Session expired. Please log in again.");
        setTimeout(() => navigate("/login"), 2000);
        return;
      }
      
      // Handle other errors
      setError(error?.response?.data?.message || error?.message || "Failed to load profile data");
      
    } finally {
      console.log("🏁 ProfilePage - Setting loading to false");
      setLoading(false);
    }
  };

  const getInitials = (name: string): string => {
    if (!name) return "U";
    return name.charAt(0).toUpperCase();
  };

  const formatGlobalRank = (rank: number): string => {
    return `#${rank.toLocaleString()}`;
  };

  const formatWinRate = (rate: number): string => {
    return `${Math.round(rate)}%`;
  };

  const getResultClass = (result: string): string => {
    return result.toLowerCase();
  };

  const getResultBadge = (result: string, ratingChange: number): JSX.Element => {
    if (result === "WIN") {
      return <span className="result-badge win">Won +{ratingChange}</span>;
    } else if (result === "LOSS") {
      return <span className="result-badge loss">Lost {ratingChange}</span>;
    } else {
      return <span className="result-badge draw">Draw +{ratingChange}</span>;
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <>
        <Navbar rating={0} streak={0} />
        <div className="profile-container">
          <div className="loading">
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>♟️</div>
            <div>Checking authentication...</div>
          </div>
        </div>
      </>
    );
  }

  // Show error if not authenticated
  if (!user) {
    return (
      <>
        <Navbar rating={0} streak={0} />
        <div className="profile-container">
          <div className="error">
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
            <div>{error || "Please log in to view your profile"}</div>
            <div style={{ fontSize: "0.9rem", color: "#888", marginTop: "0.5rem" }}>
              Redirecting to login...
            </div>
          </div>
        </div>
      </>
    );
  }

  // Show loading state while fetching profile data
  if (loading) {
    return (
      <>
        <Navbar rating={stats?.rating || 0} streak={stats?.currentStreak || 0} />
        <div className="profile-container">
          <div className="loading">
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📊</div>
            <div>Loading your profile...</div>
          </div>
        </div>
      </>
    );
  }

  // Show error if profile fetch failed
  if (error) {
    return (
      <>
        <Navbar rating={0} streak={0} />
        <div className="profile-container">
          <div className="error">
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>❌</div>
            <div>{error}</div>
            <button 
              onClick={fetchProfileData}
              style={{
                marginTop: "1.5rem",
                padding: "0.75rem 1.5rem",
                background: "#f0c419",
                color: "#000",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: 600,
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </>
    );
  }

  // Show error if stats not loaded
  if (!stats) {
    return (
      <>
        <Navbar rating={0} streak={0} />
        <div className="profile-container">
          <div className="error">
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
            <div>Failed to load profile data</div>
            <button 
              onClick={fetchProfileData}
              style={{
                marginTop: "1.5rem",
                padding: "0.75rem 1.5rem",
                background: "#f0c419",
                color: "#000",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: 600,
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar rating={stats.rating} streak={stats.currentStreak} />
      
      <div className="profile-container">
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-avatar">
            <div className="avatar-circle">{getInitials(stats.name)}</div>
            <button className="avatar-upload">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.5 7.5h-3v3h-1v-3h-3v-1h3v-3h1v3h3v1z" />
              </svg>
            </button>
          </div>

          <div className="profile-info">
            <h1 className="profile-name">{stats.name}</h1>
            <p className="profile-username">@{stats.username}</p>
          </div>

          <div className="profile-actions">
            <button className="btn-edit">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                <path d="M12.5 1.5l4 4-9 9H3.5v-4l9-9zm0 1.41L4 11.41V13h1.59l8.5-8.5L12.5 2.91z" />
              </svg>
              Edit Profile
            </button>
            <button className="btn-share">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                <path d="M13.5 12c-.8 0-1.5.3-2 .8l-5.2-3c.1-.3.2-.5.2-.8s-.1-.5-.2-.8l5.2-3c.5.5 1.2.8 2 .8 1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3c0 .3.1.5.2.8l-5.2 3c-.5-.5-1.2-.8-2-.8-1.7 0-3 1.3-3 3s1.3 3 3 3c.8 0 1.5-.3 2-.8l5.2 3c-.1.3-.2.5-.2.8 0 1.7 1.3 3 3 3s3-1.3 3-3-1.3-3-3-3z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="stats-overview">
          <div className="stat-card rating">
            <div className="stat-value">
              {stats.rating}
              <svg
                className="rating-icon"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10 1l2.5 6.5L19 8l-5.5 4.5L15 19l-5-3.5L5 19l1.5-6.5L1 8l6.5-.5L10 1z" />
              </svg>
            </div>
            <div className="stat-label">Rating</div>
            <div
              className={`stat-change ${
                stats.ratingChangeThisMonth >= 0 ? "positive" : "negative"
              }`}
            >
              {stats.ratingChangeThisMonth >= 0 ? "+" : ""}
              {stats.ratingChangeThisMonth} this month
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-value rank">
              {formatGlobalRank(stats.globalRank)}
            </div>
            <div className="stat-label">Global Rank</div>
          </div>

          <div className="stat-card">
            <div className="stat-value">{stats.gamesPlayed}</div>
            <div className="stat-label">Games Played</div>
          </div>

          <div className="stat-card">
            <div className="stat-value">{formatWinRate(stats.winRate)}</div>
            <div className="stat-label">Win Rate</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button
            className={`tab ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M2 2h6v6H2V2zm8 0h6v6h-6V2zM2 10h6v6H2v-6zm8 0h6v6h-6v-6z" />
            </svg>
            Overview
          </button>
          <button
            className={`tab ${activeTab === "games" ? "active" : ""}`}
            onClick={() => setActiveTab("games")}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M16 2H2v14h14V2zM4 14H3V4h1v10zm3 0H6V4h1v10zm3 0H9V4h1v10zm3 0h-1V4h1v10zm2 0h-1V4h1v10z" />
            </svg>
            Games
          </button>
          <button
            className={`tab ${activeTab === "ai-analysis" ? "active" : ""}`}
            onClick={() => setActiveTab("ai-analysis")}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M9 2C5.1 2 2 5.1 2 9s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7zm0 12c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z" />
            </svg>
            AI Analysis
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === "overview" && (
            <div className="overview-content">
              <div className="content-left">
                {/* Rating Progress Placeholder */}
                <div className="card rating-progress-card">
                  <div className="card-header">
                    <svg
                      className="header-icon"
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M3 3v14h14V3H3zm12 12H5V5h10v10z" />
                    </svg>
                    <h3>Rating Progress</h3>
                  </div>
                  <div className="rating-progress-placeholder">
                    <div className="placeholder-icon">
                      <svg
                        width="80"
                        height="80"
                        viewBox="0 0 80 80"
                        fill="currentColor"
                        opacity="0.3"
                      >
                        <circle
                          cx="40"
                          cy="40"
                          r="30"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path d="M40 15 L40 40 L60 50" />
                      </svg>
                    </div>
                    <p>Rating chart visualization</p>
                    <p className="placeholder-subtext">
                      Coming soon with advanced analytics
                    </p>
                  </div>
                </div>
              </div>

              <div className="content-right">
                {/* Quick Stats */}
                <div className="card quick-stats">
                  <h3 className="card-title">Quick Stats</h3>
                  <div className="quick-stats-grid">
                    <div className="quick-stat">
                      <span className="quick-stat-label">Current Streak</span>
                      <span className="quick-stat-value">
                        {stats.currentStreak} wins
                      </span>
                    </div>
                    <div className="quick-stat">
                      <span className="quick-stat-label">Best Streak</span>
                      <span className="quick-stat-value highlight">
                        {stats.bestStreak} wins
                      </span>
                    </div>
                    <div className="quick-stat">
                      <span className="quick-stat-label">Time Played</span>
                      <span className="quick-stat-value">{stats.timePlayed}</span>
                    </div>
                    <div className="quick-stat">
                      <span className="quick-stat-label">Favorite Opening</span>
                      <span className="quick-stat-value">
                        {stats.favoriteOpening}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Game Results */}
                <div className="card game-results">
                  <h3 className="card-title">Game Results</h3>
                  <div className="results-list">
                    <div className="result-item">
                      <span className="result-label">
                        Wins ({stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0}%)
                      </span>
                      <div className="result-bar-container">
                        <div
                          className="result-bar wins"
                          style={{
                            width: stats.gamesPlayed > 0 ? `${(stats.wins / stats.gamesPlayed) * 100}%` : '0%',
                          }}
                        ></div>
                      </div>
                      <span className="result-count">{stats.wins}</span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">
                        Draws ({stats.gamesPlayed > 0 ? Math.round((stats.draws / stats.gamesPlayed) * 100) : 0}%)
                      </span>
                      <div className="result-bar-container">
                        <div
                          className="result-bar draws"
                          style={{
                            width: stats.gamesPlayed > 0 ? `${(stats.draws / stats.gamesPlayed) * 100}%` : '0%',
                          }}
                        ></div>
                      </div>
                      <span className="result-count">{stats.draws}</span>
                    </div>
                    <div className="result-item">
                      <span className="result-label">
                        Losses ({stats.gamesPlayed > 0 ? Math.round((stats.losses / stats.gamesPlayed) * 100) : 0}%)
                      </span>
                      <div className="result-bar-container">
                        <div
                          className="result-bar losses"
                          style={{
                            width: stats.gamesPlayed > 0 ? `${(stats.losses / stats.gamesPlayed) * 100}%` : '0%',
                          }}
                        ></div>
                      </div>
                      <span className="result-count">{stats.losses}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "games" && (
            <div className="games-content">
              <div className="card recent-games-card">
                <div className="card-header-with-action">
                  <h3>Recent Games</h3>
                  <button className="btn-export">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M8 1v10M4 7l4 4 4-4M2 15h12" />
                    </svg>
                    Export Games
                  </button>
                </div>
                <div className="recent-games-list">
                  {recentGames.length === 0 ? (
                    <div className="no-games">No recent games found</div>
                  ) : (
                    recentGames.map((game) => (
                      <div
                        key={game.id}
                        className={`game-item ${getResultClass(game.result)}`}
                      >
                        <div className="game-indicator"></div>
                        <div className="game-info">
                          <div className="game-opponent">{game.opponentName}</div>
                          <div className="game-meta">
                            {game.accuracyPercentage}% Accuracy • {game.timeAgo}
                          </div>
                        </div>
                        <div className="game-result">
                          {getResultBadge(game.result, game.ratingChange)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "ai-analysis" && (
            <div className="ai-analysis-content">
              <div className="content-left">
                {/* Performance Areas */}
                <div className="card performance-areas-card">
                  <div className="card-header">
                    <svg
                      className="header-icon"
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M10 2C5.6 2 2 5.6 2 10s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z" />
                    </svg>
                    <h3>Performance Areas</h3>
                  </div>
                  <p className="card-subtitle">
                    AI analysis of your chess skills over the last 30 days
                  </p>

                  <div className="performance-list">
                    {performanceAreas.map((area, index) => (
                      <div key={index} className="performance-item">
                        <div className="performance-header">
                          <span className="performance-name">{area.name}</span>
                          <div className="performance-score-container">
                            <span className="performance-score">
                              {area.score}/100
                            </span>
                            <span
                              className={`performance-change ${
                                area.change >= 0 ? "positive" : "negative"
                              }`}
                            >
                              {area.change >= 0 ? "+" : ""}
                              {area.change}
                            </span>
                          </div>
                        </div>
                        <div className="performance-bar-container">
                          <div
                            className="performance-bar"
                            style={{ width: `${area.score}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="content-right">
                {/* AI Insights - Placeholder */}
                <div className="card ai-insights-card">
                  <div className="card-header">
                    <svg
                      className="header-icon"
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M10 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6l2-6z" />
                    </svg>
                    <h3>AI Insights</h3>
                  </div>
                  <p className="card-subtitle">
                    Personalized recommendations to improve your game
                  </p>

                  <div className="insights-placeholder">
                    <div className="insight-item">
                      <div className="insight-icon success">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M10 2C5.6 2 2 5.6 2 10s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm-1 12l-4-4 1.4-1.4L9 11.2l5.6-5.6L16 7l-7 7z" />
                        </svg>
                      </div>
                      <div className="insight-content">
                        <div className="insight-title">
                          Excellent Opening Preparation
                        </div>
                        <div className="insight-text">
                          You consistently play strong opening moves with 85% book
                          accuracy.
                        </div>
                        <div className="insight-recommendation">
                          Continue studying opening theory, especially in the
                          Sicilian Defense.
                        </div>
                      </div>
                    </div>

                    <div className="insight-item">
                      <div className="insight-icon warning">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <circle
                            cx="10"
                            cy="10"
                            r="8"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                          <circle cx="10" cy="14" r="1" />
                          <path
                            d="M10 6v5"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                        </svg>
                      </div>
                      <div className="insight-content">
                        <div className="insight-title">
                          Endgame Improvement Needed
                        </div>
                        <div className="insight-text">
                          Your endgame accuracy has decreased by 1% this month.
                        </div>
                        <div className="insight-recommendation">
                          Practice basic endgames like king and pawn vs king
                          positions.
                        </div>
                      </div>
                    </div>

                    <div className="insight-item">
                      <div className="insight-icon info">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <circle cx="10" cy="10" r="8" />
                          <path
                            d="M10 6v8M6 10h8"
                            stroke="white"
                            strokeWidth="2"
                          />
                        </svg>
                      </div>
                      <div className="insight-content">
                        <div className="insight-title">Time Management</div>
                        <div className="insight-text">
                          You often run low on time in complex middle game
                          positions.
                        </div>
                        <div className="insight-recommendation">
                          Practice rapid decision-making in tactical training.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ProfilePage;