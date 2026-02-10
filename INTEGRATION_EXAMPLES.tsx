// Example Integration: Using PlayerAnalysisDisplay in Different Pages

// ============================================================
// Option 1: Standalone Analysis Page
// ============================================================

// pages/AnalysisPage.tsx
import React from "react";
import Navbar from "../components/Navbar/Navbar";
import PlayerAnalysisDisplay from "../components/PlayerAnalysisDisplay";
import { useAuth } from "../context/AuthProvider";
import "./AnalysisPage.css";

export function AnalysisPage() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <div className="page-error">Please log in to view analysis</div>;
  }

  return (
    <div className="analysis-page">
      <Navbar />
      <div className="page-container">
        <div className="page-header">
          <h1>🎯 Your Chess Performance Analysis</h1>
          <p>Analyze your last 10 games to identify strengths and weaknesses</p>
        </div>

        <PlayerAnalysisDisplay
          autoLoad={true}
          onAnalysisComplete={(analysis) => {
            // Optional: Handle analysis completion
            console.log("Games analyzed:", analysis.games_analyzed);
          }}
        />
      </div>
    </div>
  );
}

// ============================================================
// Option 2: Add to Existing HomePage
// ============================================================

// Add to HomePage.tsx
import PlayerAnalysisDisplay from "../components/PlayerAnalysisDisplay";

export function HomePage() {
  // ... existing code ...

  return (
    <div className="home-page">
      <Navbar />
      <div className="page-container">
        {/* Existing content */}
        <YourStatsPanel />
        <RecentGames />

        {/* Add Analysis Section */}
        <section className="analysis-section">
          <h2>📊 Performance Analysis</h2>
          <PlayerAnalysisDisplay
            autoLoad={false} // Don't auto-load, let user trigger
            onAnalysisComplete={(analysis) => {
              // Could save to state and use elsewhere
            }}
          />
        </section>
      </div>
    </div>
  );
}

// ============================================================
// Option 3: Modal/Dialog Integration
// ============================================================

// components/AnalysisModal.tsx
import React, { useState } from "react";
import PlayerAnalysisDisplay from "./PlayerAnalysisDisplay";
import "./AnalysisModal.css";

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AnalysisModal({ isOpen, onClose }: AnalysisModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>
        <PlayerAnalysisDisplay autoLoad={true} />
      </div>
    </div>
  );
}

// Usage:
function HomePage() {
  const [showAnalysis, setShowAnalysis] = useState(false);

  return (
    <div>
      <button onClick={() => setShowAnalysis(true)}>View Analysis</button>
      <AnalysisModal isOpen={showAnalysis} onClose={() => setShowAnalysis(false)} />
    </div>
  );
}

// ============================================================
// Option 4: Profile Page Integration
// ============================================================

// Add to ProfilePage.tsx
import PlayerAnalysisDisplay, {
  PlayerAnalysisResponse,
} from "../components/PlayerAnalysisDisplay";

export function ProfilePage() {
  const [analysis, setAnalysis] = useState<PlayerAnalysisResponse | null>(null);

  return (
    <div className="profile-page">
      <Navbar />
      <div className="page-container">
        {/* Existing profile sections */}
        <ProfileHeader />
        <ProfileStats />

        {/* Analysis Section */}
        <div className="profile-analysis-section">
          <h2>📈 Performance Analysis</h2>
          <PlayerAnalysisDisplay
            autoLoad={true}
            onAnalysisComplete={(newAnalysis) => {
              setAnalysis(newAnalysis);
              // Could trigger notifications, save to DB, etc.
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Option 5: Settings Page with Analysis Controls
// ============================================================

// Add to SettingsPage.tsx
import PlayerAnalysisDisplay from "../components/PlayerAnalysisDisplay";

export function SettingsPage() {
  const [analysisAutoRefresh, setAnalysisAutoRefresh] = useState(true);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null);

  return (
    <div className="settings-page">
      <Navbar />
      <div className="page-container">
        <h1>⚙️ Settings</h1>

        {/* Existing settings */}
        <SettingsSection />

        {/* Analysis Settings */}
        <div className="settings-section">
          <h2>📊 Analysis Settings</h2>
          <label>
            <input
              type="checkbox"
              checked={analysisAutoRefresh}
              onChange={(e) => setAnalysisAutoRefresh(e.target.checked)}
            />
            Auto-refresh analysis after playing games
          </label>

          {lastAnalysisTime && (
            <p>Last analysis: {lastAnalysisTime.toLocaleDateString()}</p>
          )}
        </div>

        {/* Analysis Display */}
        <PlayerAnalysisDisplay
          autoLoad={true}
          onAnalysisComplete={(analysis) => {
            setLastAnalysisTime(new Date());
          }}
        />
      </div>
    </div>
  );
}

// ============================================================
// Option 6: Dashboard with Multiple Components
// ============================================================

// pages/DashboardPage.tsx
import React, { useState } from "react";
import PlayerAnalysisDisplay, {
  PlayerAnalysisResponse,
} from "../components/PlayerAnalysisDisplay";

export function DashboardPage() {
  const [analysis, setAnalysis] = useState<PlayerAnalysisResponse | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  return (
    <div className="dashboard">
      <Navbar />
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>📊 Chess Dashboard</h1>
        </div>

        <div className="dashboard-grid">
          {/* Left Column - Analysis */}
          <div className="dashboard-left">
            <PlayerAnalysisDisplay
              autoLoad={true}
              onAnalysisComplete={(newAnalysis) => {
                setAnalysis(newAnalysis);
              }}
            />
          </div>

          {/* Right Column - Details */}
          <div className="dashboard-right">
            {analysis && (
              <div className="analysis-details">
                <h2>📈 Details</h2>
                <div className="stats-grid">
                  <StatCard
                    label="Games Analyzed"
                    value={analysis.games_analyzed}
                  />
                  <StatCard
                    label="Strengths"
                    value={analysis.strengths.length}
                  />
                  <StatCard
                    label="Areas to Improve"
                    value={analysis.weaknesses.length}
                  />
                </div>

                <div className="recommendation-box">
                  <h3>💡 Recommendation</h3>
                  <p>{analysis.recommendation}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Option 7: Controlled Component with Custom Hooks
// ============================================================

// hooks/usePlayerAnalysis.ts
import { useState } from "react";
import aiService, { PlayerAnalysisResponse } from "../api/ai";

interface UsePlayerAnalysisReturn {
  analysis: PlayerAnalysisResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePlayerAnalysis(): UsePlayerAnalysisReturn {
  const [analysis, setAnalysis] = useState<PlayerAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await aiService.analyzePlayerGames();
      setAnalysis(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { analysis, loading, error, refresh };
}

// Usage:
function MyComponent() {
  const { analysis, loading, error, refresh } = usePlayerAnalysis();

  return (
    <div>
      {error && <div className="error">{error}</div>}
      {loading && <div className="loading">Loading...</div>}
      {analysis && <PlayerAnalysisDisplay />}
      <button onClick={refresh}>Refresh</button>
    </div>
  );
}

// ============================================================
// Option 8: Toast Notification Integration
// ============================================================

// Using a toast library like React Hot Toast
import toast from "react-hot-toast";

function PageWithAnalysis() {
  return (
    <PlayerAnalysisDisplay
      autoLoad={true}
      onAnalysisComplete={(analysis) => {
        toast.success(
          `Analysis complete! ${analysis.strengths.length} strengths found.`,
          {
            duration: 4000,
            position: "top-right",
          }
        );
      }}
    />
  );
}

// ============================================================
// Option 9: Cached Analysis with Refresh Button
// ============================================================

function PageWithCaching() {
  const [analysis, setAnalysis] = useState<PlayerAnalysisResponse | null>(null);
  const [cacheTime, setCacheTime] = useState<Date | null>(null);

  const handleRefresh = async () => {
    try {
      const result = await aiService.analyzePlayerGames();
      setAnalysis(result);
      setCacheTime(new Date());
    } catch (error) {
      console.error("Analysis failed:", error);
    }
  };

  return (
    <div>
      <div className="cache-info">
        {cacheTime && (
          <p>Last updated: {cacheTime.toLocaleTimeString()}</p>
        )}
        <button onClick={handleRefresh}>Force Refresh</button>
      </div>
      <PlayerAnalysisDisplay autoLoad={true} />
    </div>
  );
}

// ============================================================
// CSS Styling Examples
// ============================================================

/*
// AnalysisPage.css
.analysis-page {
  min-height: 100vh;
  background: #f5f7fa;
}

.page-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
}

.page-header {
  text-align: center;
  margin-bottom: 40px;
}

.page-header h1 {
  font-size: 32px;
  color: #333;
  margin-bottom: 10px;
}

.page-header p {
  font-size: 16px;
  color: #666;
}

// AnalysisModal.css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 32px;
  max-width: 900px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}
*/
