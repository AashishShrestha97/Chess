import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import Navbar from "../components/Navbar/Navbar";
import { getAccessToken } from "../utils/getAccessToken";
import "./MultiplayerChessPage.css";

interface LocationState {
  gameId: string;
  color: "white" | "black";
  timeControl: string;
  opponentName: string;
  whitePlayer: string;
  blackPlayer: string;
  whitePlayerId: number;
  blackPlayerId: number;
}

const MultiplayerChessPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;

  const gameRef = useRef(new Chess());
  const wsRef = useRef<WebSocket | null>(null);

  const [fen, setFen] = useState(gameRef.current.fen());
  const [myColor] = useState<"white" | "black">(state?.color || "white");
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState("Waiting for opponent...");
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [boardWidth, setBoardWidth] = useState(480);

  // Clocks
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);
  const [currentTurn, setCurrentTurn] = useState<"white" | "black">("white");
  const clockStartedRef = useRef(false);
  const gameOverRef = useRef(false);
  const incrementRef = useRef(0);

  // Draw offer state
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);

  // Responsive board
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      if (w >= 1400) setBoardWidth(520);
      else if (w >= 1200) setBoardWidth(480);
      else if (w >= 900) setBoardWidth(420);
      else setBoardWidth(Math.max(280, w - 60));
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Parse time control
  useEffect(() => {
    if (!state?.timeControl) return;
    const [main, inc] = state.timeControl.split("+");
    const minutes = parseFloat(main) || 0;
    const incSeconds = parseInt(inc) || 0;
    setWhiteTime(Math.round(minutes * 60));
    setBlackTime(Math.round(minutes * 60));
    incrementRef.current = incSeconds;
  }, [state?.timeControl]);

  // WebSocket connection
  useEffect(() => {
    if (!state?.gameId) {
      navigate("/home");
      return;
    }

    let cancelled = false;

    const connect = async () => {
      const token = await getAccessToken();
      if (!token || cancelled) return;

      const wsUrl = `ws://localhost:8080/api/game/${state.gameId}?token=${token}&gameId=${state.gameId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("🎮 Game WS connected");
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        handleServerMessage(JSON.parse(event.data));
      };

      ws.onerror = (err) => {
        console.error("❌ Game WS error:", err);
      };

      ws.onclose = () => {
        console.log("🔌 Game WS closed");
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (wsRef.current) wsRef.current.close();
    };
  }, [state?.gameId]);

  const handleServerMessage = useCallback((data: any) => {
    switch (data.type) {
      case "GAME_START": {
        gameRef.current = new Chess();
        setFen(gameRef.current.fen());
        clockStartedRef.current = true;
        setCurrentTurn("white");
        setStatusMessage(
          myColor === "white" ? "Your turn" : "Opponent's turn"
        );
        break;
      }

      case "WAITING_FOR_OPPONENT": {
        setStatusMessage("Waiting for opponent to connect...");
        break;
      }

      case "MOVE": {
        const game = gameRef.current;
        try {
          const move = game.move({
            from: data.from,
            to: data.to,
            promotion: data.promotion || "q",
          });
          if (move) {
            setFen(game.fen());
            setLastMove({ from: data.from, to: data.to });
            setMoveHistory((prev) => [...prev, move.san]);
            const nextTurn = data.turn as "white" | "black";
            setCurrentTurn(nextTurn);

            // Apply increment to player who just moved
            const movedColor = data.player as "white" | "black";
            if (incrementRef.current > 0) {
              if (movedColor === "white") {
                setWhiteTime((p) => p + incrementRef.current);
              } else {
                setBlackTime((p) => p + incrementRef.current);
              }
            }

            if (game.isCheckmate()) {
              const winner = movedColor;
              setGameOver(true);
              gameOverRef.current = true;
              setGameResult(`${winner === myColor ? "You win!" : "You lose!"} by checkmate`);
              setStatusMessage("Checkmate!");
            } else if (game.isDraw()) {
              setGameOver(true);
              gameOverRef.current = true;
              setGameResult("Draw!");
              setStatusMessage("Game drawn");
            } else if (game.isCheck()) {
              setStatusMessage("Check!");
            } else {
              setStatusMessage(
                nextTurn === myColor ? "Your turn" : "Opponent's turn"
              );
            }
          }
        } catch (e) {
          console.error("❌ Error applying move:", e);
        }
        break;
      }

      case "GAME_OVER": {
        setGameOver(true);
        gameOverRef.current = true;
        if (data.result === "DRAW") {
          setGameResult(`Draw by ${data.reason.toLowerCase()}`);
        } else {
          const iWin =
            (data.winner === "white" && myColor === "white") ||
            (data.winner === "black" && myColor === "black");
          setGameResult(iWin ? "You win!" : "You lose!");
        }
        setStatusMessage(data.reason || "Game over");
        break;
      }

      case "DRAW_OFFER": {
        setDrawOfferReceived(true);
        break;
      }

      case "DRAW_DECLINED": {
        setStatusMessage("Draw offer declined");
        setTimeout(() => setStatusMessage(
          currentTurn === myColor ? "Your turn" : "Opponent's turn"
        ), 2000);
        break;
      }

      case "OPPONENT_DISCONNECTED": {
        setStatusMessage("Opponent disconnected");
        break;
      }
    }
  }, [myColor]);

  // Clock ticker
  useEffect(() => {
    if (gameOver || !clockStartedRef.current) return;

    const timer = window.setInterval(() => {
      if (currentTurn === "white") {
        setWhiteTime((prev) => {
          if (prev <= 1) {
            sendMessage({ type: "FLAG" });
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackTime((prev) => {
          if (prev <= 1) {
            sendMessage({ type: "FLAG" });
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [currentTurn, gameOver]);

  // Send time updates every 5 seconds
  useEffect(() => {
    if (!clockStartedRef.current || gameOver) return;
    const timer = window.setInterval(() => {
      sendMessage({
        type: "TIME_UPDATE",
        whiteMs: whiteTime * 1000,
        blackMs: blackTime * 1000,
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [whiteTime, blackTime, gameOver]);

  const sendMessage = (msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (gameOverRef.current) return false;
    if (currentTurn !== myColor) return false;

    const game = gameRef.current;
    let move;
    try {
      move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });
    } catch {
      return false;
    }

    if (!move) return false;

    setFen(game.fen());
    setLastMove({ from: sourceSquare, to: targetSquare });
    setMoveHistory((prev) => [...prev, move.san]);

    const nextTurn = game.turn() === "w" ? "white" : "black";
    setCurrentTurn(nextTurn);

    // Apply increment
    if (incrementRef.current > 0) {
      if (myColor === "white") setWhiteTime((p) => p + incrementRef.current);
      else setBlackTime((p) => p + incrementRef.current);
    }

    sendMessage({
      type: "MOVE",
      from: sourceSquare,
      to: targetSquare,
      promotion: move.promotion || null,
      san: move.san,
      fen: game.fen(),
      turn: nextTurn,
    });

    if (game.isCheckmate()) {
      setGameOver(true);
      gameOverRef.current = true;
      setGameResult("You win! by checkmate");
    } else if (game.isDraw()) {
      setGameOver(true);
      gameOverRef.current = true;
      setGameResult("Draw!");
    } else if (game.isCheck()) {
      setStatusMessage("Check!");
    } else {
      setStatusMessage("Opponent's turn");
    }

    return true;
  };

  const getSquareStyles = () => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: "rgba(255,255,0,0.4)" };
      styles[lastMove.to] = { backgroundColor: "rgba(255,255,0,0.4)" };
    }
    return styles;
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleResign = () => {
    if (gameOver) return;
    if (confirm("Are you sure you want to resign?")) {
      sendMessage({ type: "RESIGN" });
    }
  };

  const handleOfferDraw = () => {
    if (gameOver) return;
    sendMessage({ type: "OFFER_DRAW" });
    setStatusMessage("Draw offer sent...");
  };

  const handleAcceptDraw = () => {
    sendMessage({ type: "ACCEPT_DRAW" });
    setDrawOfferReceived(false);
  };

  const handleDeclineDraw = () => {
    sendMessage({ type: "DECLINE_DRAW" });
    setDrawOfferReceived(false);
  };

  const opponentName = state?.opponentName || "Opponent";
  const myName = "You";

  const opponentIsWhite = myColor === "black";
  const opponentPlayer = opponentIsWhite ? state?.whitePlayer : state?.blackPlayer;
  const opponentClock = myColor === "white" ? blackTime : whiteTime;
  const myClock = myColor === "white" ? whiteTime : blackTime;
  const opponentIsLow = opponentClock <= 30;
  const myIsLow = myClock <= 30;

  return (
    <>
      <Navbar rating={0} streak={0} />
      <div className="mp-chess-page">
        <div className="mp-back-row">
          <button className="mp-back-btn" onClick={() => navigate("/home")}>
            ← Back to Menu
          </button>
          <div className="mp-game-info">
            <span className="mp-time-badge">⏱ {state?.timeControl}</span>
            <span className="mp-status">{statusMessage}</span>
          </div>
        </div>

        <div className="mp-main-layout">
          <div className="mp-left-column">
            {/* Opponent card (top) */}
            <div className={`mp-player-card opponent ${opponentIsLow ? "low-time" : ""}`}>
              <div className="mp-player-info">
                <div className="mp-avatar opponent">
                  {(opponentPlayer || opponentName)[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="mp-player-name">{opponentPlayer || opponentName}</div>
                  <div className="mp-player-color">
                    {myColor === "white" ? "Black" : "White"}
                  </div>
                </div>
              </div>
              <div className={`mp-clock ${opponentIsLow ? "low" : ""} ${opponentClock <= 10 ? "critical" : ""}`}>
                {formatTime(opponentClock)}
              </div>
            </div>

            {/* Board */}
            <div className="mp-board-wrapper">
              <Chessboard
                {...({
                  position: fen,
                  onPieceDrop: onDrop,
                  boardOrientation: myColor,
                  boardWidth,
                  arePiecesDraggable: !gameOver && currentTurn === myColor,
                  customSquareStyles: getSquareStyles(),
                  customBoardStyle: {
                    borderRadius: "12px",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
                  },
                } as any)}
              />
            </div>

            {/* My card (bottom) */}
            <div className={`mp-player-card me ${myIsLow ? "low-time" : ""}`}>
              <div className="mp-player-info">
                <div className="mp-avatar me">Y</div>
                <div>
                  <div className="mp-player-name">You</div>
                  <div className="mp-player-color">
                    {myColor === "white" ? "White" : "Black"}
                  </div>
                </div>
              </div>
              <div className={`mp-clock ${myIsLow ? "low" : ""} ${myClock <= 10 ? "critical" : ""}`}>
                {formatTime(myClock)}
              </div>
            </div>

            {/* Controls */}
            <div className="mp-controls">
              <button className="mp-ctrl-btn" onClick={handleOfferDraw} disabled={gameOver}>
                🤝 Offer Draw
              </button>
              <button className="mp-ctrl-btn danger" onClick={handleResign} disabled={gameOver}>
                🏳️ Resign
              </button>
            </div>
          </div>

          {/* Right column */}
          <div className="mp-right-column">
            {/* Draw offer banner */}
            {drawOfferReceived && (
              <div className="mp-draw-offer">
                <p>Opponent offers a draw</p>
                <div className="mp-draw-btns">
                  <button className="mp-draw-accept" onClick={handleAcceptDraw}>
                    ✓ Accept
                  </button>
                  <button className="mp-draw-decline" onClick={handleDeclineDraw}>
                    ✗ Decline
                  </button>
                </div>
              </div>
            )}

            {/* Game over banner */}
            {gameOver && gameResult && (
              <div className="mp-game-over-card">
                <div className="mp-game-over-icon">
                  {gameResult.includes("win") || gameResult.includes("Win") ? "🏆" : "🤝"}
                </div>
                <div className="mp-game-over-text">{gameResult}</div>
                <button className="mp-new-game-btn" onClick={() => navigate("/home")}>
                  Back to Home
                </button>
              </div>
            )}

            {/* Move History */}
            <div className="mp-move-history">
              <div className="mp-panel-header">
                <span>♟️ Move History</span>
                <span className="mp-move-count">
                  {Math.ceil(moveHistory.length / 2)} moves
                </span>
              </div>
              <div className="mp-moves-list">
                {moveHistory.length === 0 ? (
                  <div className="mp-empty">No moves yet</div>
                ) : (
                  Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => (
                    <div key={i} className="mp-move-row">
                      <span className="mp-move-num">{i + 1}.</span>
                      <span className="mp-move white">{moveHistory[i * 2]}</span>
                      <span className="mp-move black">
                        {moveHistory[i * 2 + 1] || ""}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MultiplayerChessPage;