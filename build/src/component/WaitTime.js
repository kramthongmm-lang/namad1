// WaitTime.js
import React, { useEffect, useState } from "react";
import axios from "axios";
import "../css/match.css";
import "../css/preview.css";
import { API_BASE } from "./config";

const WaitTime = ({ group }) => {
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [queueList, setQueueList] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [alertedPlayers, setAlertedPlayers] = useState({});

const OVER_TIME_SEC = 20 * 60;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!group) return;

    fetchAll();
    const loop = setInterval(fetchAll, 2000);
    return () => clearInterval(loop);
  }, [group]);

  const fetchAll = async () => {
    const [p, m, q] = await Promise.all([
      axios.get(`${API_BASE}/players/${group}`),
      axios.get(`${API_BASE}/matches/${group}`),
      axios.get(`${API_BASE}/queue/list/${group}`)
    ]);

    if (p.data.success) setPlayers(p.data.players);
    if (m.data.success) setMatches(m.data.matches);
    if (q.data.success) setQueueList(q.data.queue);
  };

  const toMs = (val) => {
    if (!val) return NaN;
    if (!isNaN(val)) return Number(val) < 1e12 ? val * 1000 : Number(val);
    return new Date(val).getTime();
  };

  const toMMSS = (end) => {
    if (!Number.isFinite(end)) return "-";
    let sec = Math.floor((now - end) / 1000);
    if (sec < 0) sec = 0;
    return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  };

  const lastEnd = {};
  matches.forEach(m => {
    const start = new Date(m.created_at).getTime();
    const end = toMs(m.EndTime);
    [m.P1, m.P2, m.P3, m.P4].forEach(p => {
      if (!p) return;
      if (!lastEnd[p] || start > lastEnd[p].start) {
        lastEnd[p] = { start, end };
      }
    });
  });

  const playAlertSound = () => {
  const audio = new Audio(
    "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
  );
  audio.play().catch(() => {});
};

// นับจำนวนเกมต่อคน
const matchCountMap = {};

matches.forEach(m => {
  [m.P1, m.P2, m.P3, m.P4].forEach(p => {
    if (!p) return;
    matchCountMap[p] = (matchCountMap[p] || 0) + 1;
  });
});

const playersWithTime = players
  .filter(p =>
    ["Active", "Wait", "Play"].includes(p.Player_Status)
  )
  .map(p => {
    const end = lastEnd[p.Player_Name]?.end;
    const waitSec = end ? Math.floor((now - end) / 1000) : 0;

    const over20 =
      waitSec >= OVER_TIME_SEC &&
      p.Player_Status !== "Play"; // ⭐ Play ไม่ต้องแดง

    return {
      ...p,
      waitSec,
      waitText: toMMSS(end),
      over20,
      isPlaying: p.Player_Status === "Play",
      matchCount: matchCountMap[p.Player_Name] || 0
    };
  })
  .sort((a, b) => b.waitSec - a.waitSec);

useEffect(() => {
  playersWithTime.forEach(p => {
    if (p.over20 && !alertedPlayers[p.Player_Name]) {
      playAlertSound();

      setAlertedPlayers(prev => ({
        ...prev,
        [p.Player_Name]: true
      }));
    }
  });
}, [playersWithTime]);

  return (
    <div className="match-container">
      <h2>⏱ จำนวนเวลารอลงสนาม</h2>
<div className="player-grid">
  {playersWithTime.map((p, i) => (
    <div
      key={i}
      className={`ps-item 
        ${p.isPlaying ? "playing" : ""}
        ${p.over20 ? "over-time" : ""}
      `}
    >
      <span className="ps-name">{p.Player_Name}</span>

      <span className="ps-time">
        {p.waitText}
        {p.over20 && " 🔴"}
      </span>

      <span className="ps-games">
        {p.matchCount} เกม
      </span>

      <span className="ps-state">
        {p.Player_Status}
      </span>
    </div>
  ))}
</div>


    </div>
  );
};

export default WaitTime;
