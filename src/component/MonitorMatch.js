// MonitorMatch.js
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import HistoryMatch from "./HistoryMatch";
import "../css/monitor_fullscreen.css";
import { API_BASE } from "./config";   // <<< ใช้แบบนี้
const rankColor = {
  BG: "#f1c40f",
  NB: "#3498db",
  N: "#1abc9c",
  S: "#2ecc71",
  P: "#e74c3c"
};

const RankBadge = ({ rank }) => (
  <span style={{
    display: "inline-block",
    minWidth: 28,
    textAlign: "center",
    background: rankColor[rank] || "#666",
    color: "#fff",
    padding: "2px 6px",
    borderRadius: 6,
    marginLeft: 8,
    fontSize: 12,
    lineHeight: "16px"
  }}>
    {rank || "-"}
  </span>
);

export default function MonitorMatch({ group }) {
  const [matches, setMatches] = useState([]);
  const [timers, setTimers] = useState({});
  const [refreshKey, setRefreshKey] = useState(0); // trigger reload history
  const [playersMap, setPlayersMap] = useState({}); // name -> { rank, status }
  const localStartRef = useRef({});
  const [queueList, setQueueList] = useState([]);

  // helper format mm:ss
  const formatTime = (sec) => {
    if (sec == null || isNaN(sec)) return "00:00";
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };
  const formatStartClock = (start) => {
    if (!start) return "-";
    const d = new Date(Number(start));
    if (isNaN(d)) return "-";
    return d.toLocaleTimeString("th-TH", { hour12: false });
  };

  // load matches (with R1..R4 if backend provides)
  useEffect(() => {
    if (!group) return;

    const fetchMatches = async () => {
      try {
        const res = await axios.get(`${API_BASE}/match/times/${group}`);
        if (res.data.success) {
          setMatches(res.data.matches || []);
          setRefreshKey((k) => k + 1);
        } else {
          setMatches([]);
        }
      } catch (err) {
        console.error("Monitor fetch error:", err);
        setMatches([]);
      }
    };

    fetchMatches();
    const loop = setInterval(fetchMatches, 4000);
    return () => clearInterval(loop);
  }, [group]);

  // if matches don't contain R1..R4, fetch players and build map
  useEffect(() => {
    const needPlayers = matches.some(m => !(m.R1 || m.R2 || m.R3 || m.R4));
    if (!group) return;
    if (!needPlayers) {
      // build playersMap from matches ranks if available
      const map = {};
      matches.forEach(m => {
        if (m.P1) map[m.P1] = { rank: m.R1 || null, status: null };
        if (m.P2) map[m.P2] = { rank: m.R2 || null, status: null };
        if (m.P3) map[m.P3] = { rank: m.R3 || null, status: null };
        if (m.P4) map[m.P4] = { rank: m.R4 || null, status: null };
      });
      setPlayersMap(map);
      return;
    }

    // fetch players endpoint and map ranks
    const fetchPlayers = async () => {
      try {
        const res = await axios.get(`${API_BASE}/players/${encodeURIComponent(group)}`);
        if (res.data.success && Array.isArray(res.data.players)) {
          const map = {};
          res.data.players.forEach(p => {
            map[p.Player_Name] = { rank: p.Player_Ranking, status: p.Player_Status };
          });
          setPlayersMap(map);
        } else {
          setPlayersMap({});
        }
      } catch (err) {
        console.error("Monitor fetch players error:", err);
        setPlayersMap({});
      }
    };

    fetchPlayers();
  }, [matches, group]);

  // Realtime Timer
  // Realtime Timer
  // Realtime Timer (based on StartTime from DB only)
  // Realtime Timer
  // Realtime Timer
  // FIXED: realtime timer
  useEffect(() => {
    const interval = setInterval(() => {
      const updated = {};

      matches.forEach((m) => {
        if (m.Match_Status !== "Play") return;

        let startMs = null;

        if (m.StartTime != null) {
  const num = Number(m.StartTime);

  // 1) แบบ YYYYMMDDHHMMSS  14 หลัก
  if (String(m.StartTime).length === 14) {
    const t = String(m.StartTime);
    const formatted =
      `${t.substring(0, 4)}-${t.substring(4, 6)}-${t.substring(6, 8)} ` +
      `${t.substring(8, 10)}:${t.substring(10, 12)}:${t.substring(12, 14)}`;

    startMs = new Date(formatted.replace(" ", "T")).getTime(); // ? FIXED
  }

  // 2) timestamp วินาที
  else if (num < 2000000000) {
    startMs = num * 1000;
  }

  // 3) timestamp millisecond
  else if (!isNaN(num)) {
    startMs = num;
  }

  // 4) ? กรณี MySQL DATETIME เช่น "2025-01-20 14:32:10"
  else if (typeof m.StartTime === "string" && m.StartTime.includes("-")) {
    startMs = new Date(m.StartTime.replace(" ", "T")).getTime();
  }
}

        // fallback (ไม่มี StartTime)
        if (!startMs) {
          if (!localStartRef.current[m.id]) {
            localStartRef.current[m.id] = Date.now();
          }
          updated[m.id] = Math.floor((Date.now() - localStartRef.current[m.id]) / 1000);
        } else {
          updated[m.id] = Math.floor((Date.now() - startMs) / 1000);
        }
      });

      setTimers(updated);
    }, 1000);

    return () => clearInterval(interval);
  }, [matches]);





  // Highlight frequent players
  const playerCount = {};
  matches.forEach((m) => {
    [m.P1, m.P2, m.P3, m.P4].forEach((p) => {
      if (!p) return;
      playerCount[p] = (playerCount[p] || 0) + 1;
    });
  });

  const getHighlightStyle = (p) => {
    const c = playerCount[p] || 0;
    if (c >= 10) return { color: "#ff4d4d", fontWeight: "bold" };
    if (c >= 5) return { color: "#ff9933", fontWeight: "bold" };
    return {};
  };
  useEffect(() => {
    if (!group) return;

    const fetchQueue = async () => {
      try {
        const res = await axios.get(`${API_BASE}/queue/${group}`);
        if (res.data.success) {
          setQueueList(res.data.queue || []);
        } else {
          setQueueList([]);
        }
      } catch (err) {
        console.error("Queue fetch error:", err);
      }
    };

    fetchQueue();
    const loop = setInterval(fetchQueue, 3000);
    return () => clearInterval(loop);
  }, [group]);

  return (
    <div className="monitor-wrapper">
      <h2 className="monitor-title"> รายการแข่งขัน – ก๊วน {group}</h2>

      <div className="monitor-container">

        {/* HISTORY (left) */}
        <div className="monitor-box">
          {/* NEXT QUEUE SECTION */}
          <div className="monitor-box">
            <h3 className="section-title queue">⏳ คิวแมตช์ถัดไป ({queueList.length}/10)</h3>

            {queueList.length === 0 && (
              <div style={{ opacity: 0.6 }}>ยังไม่มีคิวแมตช์</div>
            )}

            {queueList.map((q) => (
              <div key={q.id} className="queue-card">

                <div className="queue-title">
                  Queue #{q.Queue_No} — Court {q.Court || "-"}
                </div>

                <div className="queue-player">
                  {q.P1} <RankBadge rank={q.R1} /> /
                  {q.P2} <RankBadge rank={q.R2} />
                  <div className="vs">vs</div>
                  {q.P3} <RankBadge rank={q.R3} /> /
                  {q.P4} <RankBadge rank={q.R4} />
                </div>

              </div>
            ))}
          </div>

          <h3 className="section-title history"> ประวัติการแข่งขัน</h3>
          <div className="history-scroll">
            <HistoryMatch group={group} refreshKey={refreshKey} />
          </div>
        </div>

        {/* LIVE (right) */}
        <div className="monitor-box">
          <h3 className="section-title live">แมตช์ที่กำลังเล่น</h3>

          {matches.filter((m) => m.Match_Status === "Play").length === 0 && (
            <div style={{ opacity: 0.7 }}>ยังไม่มีแมตช์กำลังเล่น</div>
          )}

          {matches
            .filter((m) => m.Match_Status === "Play")
            .map((m) => {
              // for each player decide rank: prefer m.R1.. else lookup playersMap
              const r1 = m.R1 || playersMap[m.P1]?.rank || null;
              const r2 = m.R2 || playersMap[m.P2]?.rank || null;
              const r3 = m.R3 || playersMap[m.P3]?.rank || null;
              const r4 = m.R4 || playersMap[m.P4]?.rank || null;

              const elapsed = timers[m.id] || 0;

              return (
                <div key={m.id} className="live-card">
                  <div className="live-card-title">
                    Court {m.Court} — Match #{m.Match_no}
                    <div style={{ float: "right", textAlign: "right" }}>
                      <div style={{ fontSize: 13, opacity: 0.9 }}>
                        <span className="timer-tv">
                          ⏳ {formatTime(elapsed)} นาที
                        </span>

                      </div>


                    </div>

                  </div>

                  <div className="live-player" style={{ marginTop: 8 }}>
                    <div style={{ marginBottom: 6 }}>
                      <span style={getHighlightStyle(m.P1)}>{m.P1}</span>
                      <RankBadge rank={r1} />
                      {"  /  "}
                      <span style={getHighlightStyle(m.P2)}>{m.P2}</span>
                      <RankBadge rank={r2} />
                    </div>

                    <div style={{ color: "#999", margin: "6px 0" }}>vs</div>

                    <div>
                      <span style={getHighlightStyle(m.P3)}>{m.P3}</span>
                      <RankBadge rank={r3} />
                      {"  /  "}
                      <span style={getHighlightStyle(m.P4)}>{m.P4}</span>
                      <RankBadge rank={r4} />
                    </div>  <br></br>
               
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
