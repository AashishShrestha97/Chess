import React from "react";
import { Routes, Route, BrowserRouter } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignInPage from "./pages/SignInPage";
import HomePage from "./pages/HomePage";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import GameHistoryPage from './pages/GameHistoryPage';
import GameReviewPage from './pages/GameReviewPage';

import "./App.css";
import VoiceGamePage from "./pages/VoiceGamePage";
import StandardChessPage from "./pages/StandardChessPage";
import SettingsPage from "./pages/SettingsPage";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/voicechess" element={<VoiceGamePage />} />
        <Route path="/classicchess" element={<StandardChessPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/game-history" element={<GameHistoryPage />} />
<Route path="/game-review/:gameId" element={<GameReviewPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
