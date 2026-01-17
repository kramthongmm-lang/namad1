import React, { useEffect, useState } from "react";
import axios from "axios";
import "../css/history_match.css"; // ⭐ เพิ่มไฟล์ CSS แยก
import { API_BASE } from "./config";   // <<< ใช้แบบนี้

const HistoryMatch = ({ group, refreshKey }) => {
  const [history, setHistory] = useState([]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/match/history/${group}`);
      if (res.data.success) {
        setHistory(res.data.history);
      }
    } catch (err) {
      console.error("HistoryMatch fetch error:", err);
    }
  };

  useEffect(() => {
    if (group) fetchHistory();
  }, [group, refreshKey]);

  // แปลง Duration → mm:ss
  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return "-";
    const mm = Math.floor(seconds / 60);
    const ss = seconds % 60;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  return (
    <div className="history-wrapper">
    
      {(!history || history.length === 0) && (
        <div className="history-empty">ยังไม่มีประวัติการแข่งขัน</div>
      )}

      {history.map((m) => (
        <div key={m.id} className="history-card">
          {/* Header */}
          <div className="history-header">
            <div className="match-id">Match #{m.Match_no}</div>
            <div className="match-date">{new Date(m.created_at).toLocaleString()}</div>
          </div>

          {/* Players */}
          <div className="history-players">
            {m.P1} <span className="rank">({m.R1})</span> /
            {m.P2} <span className="rank">({m.R2})</span>
            <span className="vs"> vs </span>
            {m.P3} <span className="rank">({m.R3})</span> /
            {m.P4} <span className="rank">({m.R4})</span>
          </div>

          {/* Duration */}
          <div className="history-duration">
            ⏱ ใช้เวลา <b>{formatDuration(m.Duration)}</b> นาที
          </div>

          {/* Start - End Time */}
          <div className="history-time">
            เริ่ม: {m.StartTime ? new Date(m.StartTime).toLocaleTimeString() : "-"}
            {" • "}
            จบ: {m.EndTime ? new Date(m.EndTime).toLocaleTimeString() : "-"}
          </div>
        </div>
      ))}
    </div>
  );
};

export default HistoryMatch;
