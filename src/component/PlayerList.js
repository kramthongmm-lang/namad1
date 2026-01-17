// PlayerList.js
import React, { useState } from "react";
import axios from "axios";
import { API_BASE } from "./config";   // <<< ใช้แบบนี้
const PlayerList = ({ players = [], matchCount = {}, group }) => {

  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [historyData, setHistoryData] = useState([]);

  // โหลดประวัติผู้เล่น
  const openHistory = async (playerName) => {
    setSelectedPlayer(playerName);

    try {
      const res = await axios.get(
        `${API_BASE}:5000/match/history/${group}/${playerName}`
      );

      if (res.data.success) {
        setHistoryData(res.data.history || []);
      } else {
        setHistoryData([]);
      }
    } catch (err) {
      console.error(err);
      setHistoryData([]);
    }

    setHistoryOpen(true);
  };
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({
    Player_Name: "",
    Player_Ranking: "NB",
    Player_Status: "Active"
  });
  const startEdit = (p) => {
    setEditId(p.id);
    setEditData({
      Player_Name: p.Player_Name,
      Player_Ranking: p.Player_Ranking,
      Player_Status: p.Player_Status
    });
  };

  return (
    <div className="player-list">
      <h3>รายชื่อผู้เล่น (Active + Play)</h3>

      {players.length === 0 && <div>ไม่มีผู้เล่นในกลุ่มนี้</div>}

      {players.map((p) => {
        const played = matchCount[p.Player_Name] || 0;

        return (
          <div key={p.id} className="player-row">

            {/* =======================
        PLAYER NAME + MATCH COUNT + TIMESTAMP
    ======================== */}
            <div
              className="player-name"
              onClick={() => openHistory(p.Player_Name)}
              style={{ cursor: "pointer" }}
            >
              {p.Player_Name}

              {/* จำนวนเกม */}
              <span style={{ marginLeft: 6, color: "#00ff9d", fontSize: "13px" }}>
                — {played} Match
              </span>

              {/* เวลา TimeStamp */}
              {p.TimeStamp && (
                <span
                  style={{
                    marginLeft: 8,
                    color: "#40C4FF",
                    fontSize: "12px",
                    fontStyle: "italic",
                  }}
                >
                  ({new Date(p.TimeStamp).toLocaleString("th-TH", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })})
                </span>
              )}
            </div>

            {/* RANK */}
            <div className="player-rank">
              Ranking: <b>{p.Player_Ranking}</b>
            </div>

            {/* STATUS */}
            <div
              className="player-status"
              style={{
                color: p.Player_Status === "Play" ? "#ffcc00" : "#00e676",
                fontWeight: "bold",
              }}
            >
              {p.Player_Status}
            </div>
          </div>
        );
      })}

      {/* =======================================================
                      HISTORY MODAL (Horizontal)
      ======================================================== */}
    </div>
  );
};

export default PlayerList;
