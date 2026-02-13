import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar/Navbar";
import { getAccessToken } from "../utils/getAccessToken";
import "./MatchmakingPage.css";

interface MatchmakingState {
  timeControl: string;
  gameType: "STANDARD" | "VOICE";
}

const MatchmakingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as MatchmakingState;

  const [status, setStatus] = useState<"connecting" | "waiting" | "found">("connecting");
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [matchInfo, setMatchInfo] = useState<{
    gameId: string;
    color: string;
    opponentName: string;
    timeControl: string;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number | null>(null);

  const timeControl = state?.timeControl || "10+0";
  const gameType = state?.gameType || "STANDARD";

  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      const token = await getAccessToken();
      if (!token || cancelled) return;

      const wsUrl = `ws://localhost:8080/api/matchmaking?token=${token}&timeControl=${encodeURIComponent(timeControl)}&gameType=${gameType}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!cancelled) setStatus("waiting");
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        const data = JSON.parse(event.data);

        if (data.type === "WAITING") {
          setStatus("waiting");
          // Start timer
          timerRef.current = window.setInterval(() => {
            setTimeElapsed((prev) => prev + 1);
          }, 1000);
        }

        if (data.type === "MATCH_FOUND") {
          setStatus("found");
          if (timerRef.current) clearInterval(timerRef.current);

          const opponentName =
            data.color === "white" ? data.blackPlayer : data.whitePlayer;

          setMatchInfo({
            gameId: data.gameId,
            color: data.color,
            opponentName,
            timeControl: data.timeControl,
          });

          // Navigate after short delay to show match found
          setTimeout(() => {
            const route =
              gameType === "VOICE" ? "/voicechess/multiplayer" : "/classicchess/multiplayer";
            navigate(route, {
              state: {
                gameId: data.gameId,
                color: data.color,
                timeControl: data.timeControl,
                opponentName,
                whitePlayer: data.whitePlayer,
                blackPlayer: data.blackPlayer,
                whitePlayerId: data.whitePlayerId,
                blackPlayerId: data.blackPlayerId,
              },
            });
          }, 2000);
        }
      };

      ws.onerror = (err) => {
        console.error("❌ Matchmaking WS error:", err);
      };

      ws.onclose = () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleCancel = () => {
    if (wsRef.current) wsRef.current.close();
    navigate("/home");
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <>
      <Navbar rating={0} streak={0} />
      <div className="matchmaking-page">
        <div className="matchmaking-card">
          {status === "connecting" && (
            <div className="matchmaking-content">
              <div className="matchmaking-spinner" />
              <h2>Connecting...</h2>
              <p>Establishing connection to matchmaking server</p>
            </div>
          )}

          {status === "waiting" && (
            <div className="matchmaking-content">
              <div className="matchmaking-spinner searching" />
              <h2>Finding Opponent</h2>
              <p className="time-control-badge">⏱ {timeControl}</p>
              <p className="game-type-badge">
                {gameType === "VOICE" ? "🎤 Voice Chess" : "♟ Standard Chess"}
              </p>
              <div className="elapsed-time">
                Searching for {formatTime(timeElapsed)}
              </div>
              <div className="matchmaking-dots">
                <span />
                <span />
                <span />
              </div>
              <button className="cancel-btn" onClick={handleCancel}>
                Cancel Search
              </button>
            </div>
          )}

          {status === "found" && matchInfo && (
            <div className="matchmaking-content found">
              <div className="match-found-icon">🎉</div>
              <h2>Opponent Found!</h2>
              <div className="match-details">
                <div className="match-player">
                  <span className="player-color-dot white" />
                  <span>
                    {matchInfo.color === "white" ? "You" : matchInfo.opponentName}
                  </span>
                </div>
                <div className="vs-divider">VS</div>
                <div className="match-player">
                  <span className="player-color-dot black" />
                  <span>
                    {matchInfo.color === "black" ? "You" : matchInfo.opponentName}
                  </span>
                </div>
              </div>
              <p>You play as {matchInfo.color}</p>
              <p className="starting-text">Starting game...</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MatchmakingPage;