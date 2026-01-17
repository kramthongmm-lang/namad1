import React, { useState, useEffect } from "react";
import { API_BASE } from "./config";
import Select from "react-select";
import "../css/preview.css";

// -----------------------------------------------
// Rank Badge
// -----------------------------------------------
const rankColor = {
  BG: "#f1c40f",
  NB: "#3498db",
  N: "#1abc9c",
  S: "#2ecc71",
  P: "#e74c3c",
};

const RankBadge = ({ rank }) => (
  <span
    style={{
      background: rankColor[rank] || "#777",
      color: "#fff",
      padding: "2px 6px",
      borderRadius: 6,
      marginLeft: 6,
      fontSize: 11,
    }}
  >
    {rank || "-"}
  </span>
);

// -----------------------------------------------
// Main MatchPanel Component
// -----------------------------------------------
const MatchPanel = ({
  players = [],
  matches = [],

  team1_p1,
  team1_p2,
  team2_p1,
  team2_p2,
  setTeam1P1,
  setTeam1P2,
  setTeam2P1,
  setTeam2P2,

  handleManualCreate,
  deleteMatch,
  getPlayerInfo,
}) => {
  // -----------------------------------------------
  // Time / New Match
  // -----------------------------------------------
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const NEW_MATCH_SEC = 3 * 60;

  const isNewMatch = (m) => {
    const start = m.Time_Start
      ? new Date(m.Time_Start).getTime()
      : new Date(m.created_at).getTime();

    if (!start) return false;
    const diff = (now - start) / 1000;
    return diff >= 0 && diff <= NEW_MATCH_SEC;
  };

  // -----------------------------------------------
  // Timer
  // -----------------------------------------------
  const [runningTimers, setRunningTimers] = useState({});
  const [elapsedTimes, setElapsedTimes] = useState({});

  const getMatchStartTime = (m) => {
    if (m.Time_Start) return new Date(m.Time_Start).getTime();
    if (m.created_at) return new Date(m.created_at).getTime();
    return null;
  };

  useEffect(() => {
    const updated = {};
    matches.forEach((m) => {
      if (m.Match_Status !== "End") {
        const start = getMatchStartTime(m);
        if (start) updated[m.id] = start;
      }
    });
    setRunningTimers(updated);
  }, [matches]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTimes((prev) => {
        const out = { ...prev };
        for (const id in runningTimers) {
          out[id] = Date.now() - runningTimers[id];
        }
        return out;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [runningTimers]);

  const formatTime = (ms) => {
    const sec = Math.floor(ms / 1000);
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const handleEndMatch = (id) => {
    const start = runningTimers[id];
    const end = Date.now();
    const durationSec = Math.floor((end - start) / 1000);

    fetch(`${API_BASE}/match/end/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        StartTime: start,
        EndTime: end,
        Duration: durationSec,
      }),
    });
  };

  // -----------------------------------------------
  // Select
  // -----------------------------------------------
  const activeOptions = players
    .filter((p) => p.Player_Status === "Active")
    .map((p) => ({
      value: p.Player_Name,
      label: `${p.Player_Name} (${p.Player_Ranking})`,
      gender: p.Player_Gender,
    }));

  const colourStyles = {
    option: (styles, { data }) => ({
      ...styles,
      color: data.gender === "ชาย" ? "red" : "blue",
    }),
    singleValue: (styles, { data }) => ({
      ...styles,
      color: data?.gender === "ชาย" ? "red" : "blue",
    }),
  };

  // -----------------------------------------------
  // Pagination
  // -----------------------------------------------
  const [page, setPage] = useState(1);
  const limit = 15;
  const totalPages = Math.ceil(matches.length / limit) || 1;
  const showMatches = matches.slice(
    (page - 1) * limit,
    page * limit
  );

  // -----------------------------------------------
  // Helper
  // -----------------------------------------------
  const getDisplayInfo = (m, pos) => {
    const name = m[pos];
    let rank = null;
    let status = null;

    if (m[`R${pos.slice(1)}`]) rank = m[`R${pos.slice(1)}`];
    else if (getPlayerInfo) rank = getPlayerInfo(name)?.rank;

    if (getPlayerInfo) status = getPlayerInfo(name)?.status;

    return { name, rank, status };
  };

  const renderTeamInline = (p1, p2) => (
    <>
      {p1.name}
      {p1.rank && <RankBadge rank={p1.rank} />}
      {p2.name && (
        <>
          , {p2.name}
          {p2.rank && <RankBadge rank={p2.rank} />}
        </>
      )}
    </>
  );

  // -----------------------------------------------
  // UI
  // -----------------------------------------------
  return (
    <div className="match-list-panel">
      <h3 className="match-title">รายการ Match</h3>

      {showMatches.map((m) => {
        const a = getDisplayInfo(m, "P1");
        const b = getDisplayInfo(m, "P2");
        const c = getDisplayInfo(m, "P3");
        const d = getDisplayInfo(m, "P4");

        const elapsed = elapsedTimes[m.id] || 0;

        return (
          <div
            key={m.id}
            className={`match-card-pro match-play   ${m.Match_Status === "End" ? "match-end" : "match-play"}
    ${m.Match_Status !== "End" && isNewMatch(m) ? "match-new" : ""}
  `}
          >
            <div className="match-head">
              <span>Match #{m.Match_no}</span>
              <span>Court {m.Court}</span>
              {m.Match_Status !== "End" && isNewMatch(m) && (
                <span className="new-badge">NEW</span>
              )}
            </div>

            {m.Match_Status !== "End" && (
              <div className="match-timer">
                ⏱ {formatTime(elapsed)}
              </div>
            )}

            {/* ✅ แสดงเป็นแถวเดียว */}
            <div className="match-row-inline">
              <span className="team-inline">
                {renderTeamInline(a, b)}
              </span>
              <span className="vs-inline"> VS </span>
              <span className="team-inline">
                {renderTeamInline(c, d)}
              </span>
            </div>

            <div className="match-buttons">
              {m.Match_Status !== "End" && (
                <button
                  className="btn-end"
                  onClick={() => handleEndMatch(m.id)}
                >
                  End
                </button>
              )}
              <button
                className="btn-delete"
                onClick={() => deleteMatch(m.id)}
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}

      {matches.length > limit && (
        <div className="pagination-box">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ก่อนหน้า
          </button>
          <span>
            หน้า {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            ถัดไป
          </button>
        </div>
      )}
    </div>
  );
};

export default MatchPanel;
