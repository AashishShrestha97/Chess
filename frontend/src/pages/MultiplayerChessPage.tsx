import React from "react";
import { useLocation, Navigate } from "react-router-dom";
import StandardChessPage from "./StandardChessPage";
import VoiceGamePage from "./VoiceGamePage";

/**
 * MultiplayerChessPage is a thin router.
 *
 * Both /classicchess/multiplayer and /voicechess/multiplayer point here.
 * It reads gameType from location.state (set by MatchmakingPage on GAME_FOUND)
 * and renders the correct chess page.
 *
 * location.state shape (set by MatchmakingPage):
 *   gameId        : number   — Long DB id, used in WS path /api/game/{gameId}
 *   gameUuid      : string
 *   color         : "white" | "black"
 *   timeControl   : string
 *   gameType      : "STANDARD" | "VOICE"
 *   opponentName  : string
 *   whitePlayer   : string
 *   blackPlayer   : string
 *   whitePlayerId : number
 *   blackPlayerId : number
 */
const MultiplayerChessPage: React.FC = () => {
  const location = useLocation();
  const state = location.state as { gameType?: string } | null;

  if (!state?.gameType) {
    // No game state — someone navigated here directly, send them home
    return <Navigate to="/home" replace />;
  }

  if (state.gameType === "VOICE") {
    return <VoiceGamePage />;
  }

  return <StandardChessPage />;
};

export default MultiplayerChessPage;