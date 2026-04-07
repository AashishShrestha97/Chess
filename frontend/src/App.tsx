import React from "react";
import { Routes, Route, BrowserRouter } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignInPage from "./pages/SignInPage";
import HomePage from "./pages/HomePage";
import ProtectedRoute from "./components/ProtectedRoute";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import GameHistoryPage from './pages/GameHistoryPage';
import GameReviewPage from './pages/GameReviewPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import RankingsPage from './pages/RankingsPage';

import "./App.css";
import VoiceGamePage from "./pages/VoiceGamePage";
import StandardChessPage from "./pages/StandardChessPage";
import SettingsPage from "./pages/SettingsPage";
import MatchmakingPage from "./pages/MatchmakingPage";
// MultiplayerChessPage import removed — no longer needed

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signin" element={<SignInPage />} />

        {/* Protected routes */}
        <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/game-history" element={<ProtectedRoute><GameHistoryPage /></ProtectedRoute>} />
        <Route path="/game-review/:gameId" element={<ProtectedRoute><GameReviewPage /></ProtectedRoute>} />
        <Route path="/rankings" element={<ProtectedRoute><RankingsPage /></ProtectedRoute>} />
        <Route path="/matchmaking" element={<ProtectedRoute><MatchmakingPage /></ProtectedRoute>} />
        <Route path="/classicchess" element={<ProtectedRoute><StandardChessPage /></ProtectedRoute>} />
        <Route path="/voicechess"   element={<ProtectedRoute><VoiceGamePage /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;