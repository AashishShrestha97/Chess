// frontend/src/pages/RankingsPage.tsx  — replace the existing file
import React, { useState, useEffect, useCallback } from "react";
import { FiSearch, FiUsers, FiAward, FiTrendingUp } from "react-icons/fi";
import Navbar from "../components/Navbar/Navbar";
import {
  getLeaderboard,
  displayRating,
  rdLabel,
  type LeaderboardEntry,
  type LeaderboardResponse,
} from "../api/ratings";
import "./RankingsPage.css";

const PAGE_SIZE = 50;

/* ── helpers ──────────────────────────────────────────── */
function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}
function avatarClass(rank: number, isMe: boolean) {
  if (isMe)    return "av-me";
  if (rank===1) return "av-gold";
  if (rank===2) return "av-silver";
  if (rank===3) return "av-bronze";
  return "av-default";
}
function rankMedal(rank: number) {
  if (rank===1) return "🥇";
  if (rank===2) return "🥈";
  if (rank===3) return "🥉";
  return null;
}

/* ── Podium card ──────────────────────────────────────── */
const PodiumCard: React.FC<{ player: LeaderboardEntry }> = ({ player }) => {
  const medal = rankMedal(player.rank)!;
  const cls   = player.rank===1 ? "first" : player.rank===2 ? "second" : "third";
  return (
    <div className={`podium-card ${cls}`}>
      <span className={`podium-rank-badge ${cls}`}>#{player.rank}</span>
      <div className="podium-medal-large">{medal}</div>
      <div className={`podium-avatar ${avatarClass(player.rank, player.isCurrentUser)}`}>
        {getInitials(player.name)}
      </div>
      <div className="podium-name">{player.name}</div>
      {/* Show Glicko-2 rating */}
      <div className="podium-rating">{displayRating(player.glickoRating)}</div>
      <div className="podium-games">{player.gamesPlayed} games</div>
    </div>
  );
};

/* ── Row ──────────────────────────────────────────────── */
const RankRow: React.FC<{ player: LeaderboardEntry }> = ({ player }) => {
  const medal = rankMedal(player.rank);
  const avCls = avatarClass(player.rank, player.isCurrentUser);
  const rd    = Math.round(player.glickoRd);

  return (
    <div className={`rankings-row ${player.isCurrentUser ? "is-me" : ""} ${
      player.rank===1 ? "top-1" : player.rank===2 ? "top-2" : player.rank===3 ? "top-3" : ""
    }`}>

      {/* Rank */}
      <div className="rank-cell">
        {medal
          ? <span className="rank-medal">{medal}</span>
          : <span className={`rank-number ${player.rank <= 10 ? "top-10" : ""}`}>
              #{player.rank}
            </span>}
      </div>

      {/* Player */}
      <div className="player-cell">
        <div className={`player-avatar ${avCls}`}>{getInitials(player.name)}</div>
        <div className="player-name-wrap">
          <div className={`player-name ${player.isCurrentUser ? "is-me" : ""}`}>
            {player.name}
          </div>
          <div className="player-badges">
            {player.isCurrentUser && <span className="badge-you">You</span>}
            {player.currentStreak >= 3 && (
              <span className="badge-streak">🔥 {player.currentStreak} streak</span>
            )}
          </div>
        </div>
      </div>

      {/* Glicko-2 Rating + RD */}
      <div className="rating-cell">
        <div className="rating-value">{displayRating(player.glickoRating)}</div>
        <div className="rating-rd-small" title="Rating Deviation">
          ±{rd} <span style={{ color: "#555" }}>({rdLabel(player.glickoRd)})</span>
        </div>
      </div>

      {/* Games */}
      <div className="games-cell">
        <div className="games-value">{player.gamesPlayed.toLocaleString()}</div>
        <div className="winrate-bar-wrap">
          <div
            className="winrate-bar-fill"
            style={{ width: `${Math.min(player.winRate, 100)}%` }}
          />
        </div>
      </div>

      {/* Win rate */}
      <div className="winrate-cell">
        <span className="winrate-value">{player.winRate.toFixed(1)}%</span>
      </div>

      {/* Streak */}
      <div className="streak-cell">
        {player.currentStreak > 0
          ? <span className="streak-value"><span className="streak-fire">🔥</span>{player.currentStreak}</span>
          : <span style={{ color: "#444", fontSize: "0.85rem" }}>—</span>}
      </div>
    </div>
  );
};

/* ── Main ─────────────────────────────────────────────── */
const RankingsPage: React.FC = () => {
  const [data,      setData]      = useState<LeaderboardResponse | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [page,      setPage]      = useState(0);
  const [query,     setQuery]     = useState("");
  const [filtered,  setFiltered]  = useState<LeaderboardEntry[] | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true); setError(null);
    try {
      const res = await getLeaderboard(p, PAGE_SIZE);
      setData(res.data);
    } catch {
      setError("Failed to load leaderboard. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  // Client-side search filter
  useEffect(() => {
    if (!query.trim() || !data) { setFiltered(null); return; }
    const q = query.toLowerCase();
    setFiltered(
      data.rankings.filter((p) => p.name.toLowerCase().includes(q))
    );
  }, [query, data]);

  const displayed    = filtered ?? data?.rankings ?? [];
  const top3         = (data?.rankings ?? []).slice(0, 3);
  const totalPages   = Math.ceil((data?.totalPlayers ?? 0) / PAGE_SIZE);
  const myRank       = data?.currentUserRank;

  return (
    <div className="rankings-page">
      <Navbar
        rating={myRank ? displayRating(myRank.glickoRating) : 0}
        streak={myRank?.currentStreak ?? 0}
      />

      <div className="rankings-container">
        {/* Header */}
        <header className="rankings-header">
          <span className="rankings-trophy-icon">🏆</span>
          <h1 className="rankings-title">Leaderboard</h1>
          <p className="rankings-subtitle">
            Ranked by Glicko-2 rating — the same system used by FIDE and Lichess
          </p>
        </header>

        {/* Meta pills */}
        <div className="rankings-meta">
          <div className="meta-pill">
            <FiUsers size={13} />{(data?.totalPlayers ?? 0).toLocaleString()} players
          </div>
          {myRank && (
            <div className="meta-pill">
              <FiAward size={13} />Your rank: #{myRank.rank}
            </div>
          )}
          <div className="meta-pill"><FiTrendingUp size={13} />Live Glicko-2</div>
        </div>

        {/* My rank banner */}
        {myRank && (
          <div className="my-rank-banner">
            <div>
              <div className="my-rank-label">Your ranking</div>
              <div className="my-rank-number">#{myRank.rank}</div>
            </div>
            <div style={{ borderLeft: "1px solid rgba(255,215,0,0.2)", paddingLeft: 20 }}>
              <div className="my-rank-name">{myRank.name}</div>
              <div style={{ fontSize: "0.8rem", color: "#888", marginTop: 2 }}>
                ±{Math.round(myRank.glickoRd)} RD
              </div>
            </div>
            <div className="my-rank-stats">
              <div className="my-rank-stat">
                <span className="val">{myRank.wins}</span>
                <span className="cap">Wins</span>
              </div>
              <div className="my-rank-stat">
                <span className="val">{myRank.losses}</span>
                <span className="cap">Losses</span>
              </div>
              <div className="my-rank-stat">
                <span className="val">{myRank.draws}</span>
                <span className="cap">Draws</span>
              </div>
              <div className="my-rank-stat">
                <span className="val">{myRank.winRate.toFixed(1)}%</span>
                <span className="cap">Win rate</span>
              </div>
            </div>
            <div className="my-rank-rating">{displayRating(myRank.glickoRating)}</div>
          </div>
        )}

        {/* Podium */}
        {!loading && !filtered && top3.length === 3 && (
          <div className="podium-row">
            <PodiumCard player={top3[1]} />
            <PodiumCard player={top3[0]} />
            <PodiumCard player={top3[2]} />
          </div>
        )}

        {/* Search */}
        <div className="rankings-controls">
          <div className="rankings-search-wrap">
            <span className="rankings-search-icon"><FiSearch /></span>
            <input
              className="rankings-search"
              placeholder="Search players..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="rankings-table-card">
          <div className="rankings-table-head">
            <div>Rank</div>
            <div>Player</div>
            <div className="col-right">Rating ±RD</div>
            <div className="col-right col-games">Games</div>
            <div className="col-right col-winrate">Win Rate</div>
            <div className="col-right col-streak">Streak</div>
          </div>

          {loading ? (
            <div className="rankings-loading">
              <div className="loading-spinner" />
              <p>Loading leaderboard…</p>
            </div>
          ) : error ? (
            <div className="rankings-empty">
              <span className="rankings-empty-icon">⚠️</span>
              <p className="rankings-empty-text">{error}</p>
            </div>
          ) : displayed.length === 0 ? (
            <div className="rankings-empty">
              <span className="rankings-empty-icon">🔍</span>
              <p className="rankings-empty-text">
                {query ? `No players found for "${query}"` : "No players ranked yet."}
              </p>
            </div>
          ) : (
            displayed.map((p) => <RankRow key={p.userId} player={p} />)
          )}
        </div>

        {/* Pagination */}
        {!filtered && !loading && totalPages > 1 && (
          <div className="rankings-pagination">
            <button
              className="pagination-btn"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >← Previous</button>
            <span className="pagination-info">
              Page {page + 1} of {totalPages}
            </span>
            <button
              className="pagination-btn"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >Next →</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RankingsPage;