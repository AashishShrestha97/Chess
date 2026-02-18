import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAccessToken } from "../utils/getAccessToken";

interface MatchmakingState {
  timeControl: string;
  gameType: "STANDARD" | "VOICE";
}

interface GameFoundMessage {
  type: "GAME_FOUND";
  gameId: number;        // DB Long ID — used in WS path /api/game/{gameId}
  gameUuid: string;
  color: "white" | "black";
  timeControl: string;
  gameType: string;
  whitePlayer: string;
  blackPlayer: string;
  whitePlayerId: number;
  blackPlayerId: number;
}

const MatchmakingPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as MatchmakingState | null;

  // Both values come from HomePage — never show a setup UI here
  const timeControl = state?.timeControl ?? "10+0";
  const gameType    = state?.gameType    ?? "STANDARD";

  const wsRef        = useRef<WebSocket | null>(null);
  const cancelledRef = useRef(false);
  const [status, setStatus] = useState<"connecting" | "waiting" | "found" | "error">("connecting");
  const [dots,   setDots]   = useState("");

  // Animated dots
  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 500);
    return () => clearInterval(id);
  }, []);

  // Connect to matchmaking WS immediately on mount (state already set by HomePage)
  useEffect(() => {
    cancelledRef.current = false;

    const connect = async () => {
      const token = await getAccessToken();
      if (!token) { setStatus("error"); return; }

      // encodeURIComponent so "10+0" becomes "10%2B0" — the "+" must not be sent raw
      const encodedTC = encodeURIComponent(timeControl);
      const wsUrl = `ws://localhost:8080/api/matchmaking?token=${token}&timeControl=${encodedTC}&gameType=${gameType}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!cancelledRef.current) {
          console.log("🎯 Matchmaking WS connected");
          setStatus("waiting");
        }
      };

      ws.onmessage = (event) => {
        if (cancelledRef.current) return;
        try {
          const data = JSON.parse(event.data);
          console.log("📨 Matchmaking:", data);

          if (data.type === "WAITING") {
            setStatus("waiting");

          } else if (data.type === "GAME_FOUND") {
            const msg = data as GameFoundMessage;
            setStatus("found");

            // Route to VoiceGamePage or StandardChessPage based on gameType
            const route = msg.gameType === "VOICE"
              ? "/voicechess/multiplayer"
              : "/classicchess/multiplayer";

            setTimeout(() => {
              navigate(route, {
                state: {
                  gameId:        msg.gameId,      // Long DB id — used for WS /api/game/{gameId}
                  gameUuid:      msg.gameUuid,
                  color:         msg.color,
                  timeControl:   msg.timeControl,
                  gameType:      msg.gameType,
                  opponentName:  msg.color === "white" ? msg.blackPlayer : msg.whitePlayer,
                  whitePlayer:   msg.whitePlayer,
                  blackPlayer:   msg.blackPlayer,
                  whitePlayerId: msg.whitePlayerId,
                  blackPlayerId: msg.blackPlayerId,
                },
              });
            }, 800); // Short delay so "Match Found!" flashes before navigation
          }
        } catch (e) {
          console.error("Matchmaking parse error:", e);
        }
      };

      ws.onerror = () => {
        if (!cancelledRef.current) {
          console.error("❌ Matchmaking WS error");
          setStatus("error");
        }
      };

      ws.onclose = () => {
        if (!cancelledRef.current && status !== "found") {
          console.log("🔌 Matchmaking WS closed");
        }
      };
    };

    connect();

    return () => {
      cancelledRef.current = true;
      wsRef.current?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionally runs once

  const handleCancel = () => {
    cancelledRef.current = true;
    wsRef.current?.send(JSON.stringify({ type: "CANCEL" }));
    wsRef.current?.close();
    navigate(-1);
  };

  const icon = status === "found" ? "🏆" : status === "error" ? "✕" : "♟";
  const title = status === "found" ? "Match Found!" : status === "error" ? "Connection Failed" : "Finding Match";

  const statusText = {
    connecting: `Connecting${dots}`,
    waiting:    `Searching for opponent${dots}`,
    found:      "Opponent found! Starting game...",
    error:      "Could not connect. Check that the backend is running.",
  }[status];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0a0a 0%, #111 50%, #0d0d0d 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "#fff",
    }}>
      {/* Checkerboard background */}
      <div style={{
        position: "fixed", inset: 0, opacity: 0.025, pointerEvents: "none",
        backgroundImage: "repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%)",
        backgroundSize: "48px 48px",
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "24px",
        padding: "48px 64px",
        textAlign: "center",
        maxWidth: "480px",
        width: "90vw",
        boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
      }}>

        {/* Icon */}
        <div style={{
          fontSize: "4rem", marginBottom: "24px",
          display: "inline-block",
          animation: status === "waiting" ? "spin 3s linear infinite" : "none",
        }}>
          {icon}
        </div>

        <h1 style={{
          fontSize: "1.8rem", fontWeight: 700, marginBottom: "8px",
          background: "linear-gradient(135deg, #ffd700, #ffaa00)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          {title}
        </h1>

        <p style={{ color: "#888", marginBottom: "28px", fontSize: "1rem" }}>
          {statusText}
        </p>

        {/* Game info pills */}
        <div style={{
          display: "flex", gap: "10px", justifyContent: "center",
          flexWrap: "wrap", marginBottom: "32px",
        }}>
          <div style={{
            background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)",
            borderRadius: "20px", padding: "6px 18px", fontSize: "0.88rem", color: "#ffd700",
          }}>
            ⏱ {timeControl}
          </div>
          <div style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "20px", padding: "6px 18px", fontSize: "0.88rem", color: "#ccc",
          }}>
            {gameType === "VOICE" ? "🎤 Voice Chess" : "♟ Classic Chess"}
          </div>
        </div>

        {/* Pulsing dots while searching */}
        {status === "waiting" && (
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "32px" }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: "#ffd700",
                animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite`,
                opacity: 0.8,
              }} />
            ))}
          </div>
        )}

        {/* Error box */}
        {status === "error" && (
          <div style={{
            background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)",
            borderRadius: "12px", padding: "14px 18px",
            marginBottom: "24px", color: "#ff6b6b", fontSize: "0.9rem",
          }}>
            Could not connect to matchmaking server. Make sure the backend is running.
          </div>
        )}

        {/* Cancel button */}
        {status !== "found" && (
          <button
            onClick={handleCancel}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#777", padding: "12px 36px",
              borderRadius: "12px", cursor: "pointer",
              fontSize: "0.9rem", transition: "all 0.2s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,80,80,0.5)"; e.currentTarget.style.color = "#ff6b6b"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "#777"; }}
          >
            Cancel
          </button>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(0.6); opacity: 0.4; }
          50%       { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default MatchmakingPage;