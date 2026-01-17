// NextMatchQueue.js
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "../css/nextqueue.css";
import Select from "react-select";
import { API_BASE } from "./config";

const NextMatchQueue = () => {
  const { group } = useParams();
  const navigate = useNavigate();

  const [players, setPlayers] = useState([]);
  const [nextMatches, setNextMatches] = useState([]);

  // โหลดข้อมูลจาก localStorage (Match.js จะเป็นคนใส่ข้อมูลลงไป)
  useEffect(() => {
    const saved = localStorage.getItem("nextMatches_" + group);
    if (saved) setNextMatches(JSON.parse(saved));

    fetchPlayers();

    // อัปเดต UI ทุก 2 วินาที
    const timer = setInterval(() => {
      const saved = localStorage.getItem("nextMatches_" + group);
      if (saved) setNextMatches(JSON.parse(saved));
    }, 2000);

    return () => clearInterval(timer);
  }, [group]);

  // โหลดรายชื่อผู้เล่น
  const fetchPlayers = async () => {
    const res = await axios.get(`${API_BASE}/players/${group}`);
    if (res.data.success) setPlayers(res.data.players);
  };

  // เซฟคิวลง localStorage
  const saveQueue = (arr) => {
    setNextMatches(arr);
    localStorage.setItem("nextMatches_" + group, JSON.stringify(arr));
  };

  // เริ่ม match จริง
  const startMatch = async (match, index) => {
    try {
      await axios.post(`${API_BASE}/match/create`, {
        group,
        p1: match.p1,
        p2: match.p2,
        p3: match.p3,
        p4: match.p4,
        r1: match.r1,
        r2: match.r2,
        r3: match.r3,
        r4: match.r4,
        court: match.court,
        status: "Play",
      });

      const updated = nextMatches.filter((_, i) => i !== index);
      saveQueue(updated);
    } catch (err) {
      console.error(err);
    }
  };

  // =============================
  // UPDATE FIELD + UPDATE STATUS
  // =============================
  const updateField = async (index, field, newPlayer) => {
    const oldPlayer = nextMatches[index][field];
    const queueId = nextMatches[index].id; // ต้องมี id จาก DB

    // อัปเดต UI
    const updated = [...nextMatches];
    updated[index][field] = newPlayer;
    saveQueue(updated);

    try {
      // 1) อัปเดตชื่อใน queue_match
      await axios.post(`${API_BASE}/queue/update`, {
        id: queueId,
        field,
        value: newPlayer,
      });

      // 2) เปลี่ยนสถานะผู้เล่น (old -> Active, new -> Wait)
      await axios.post(`${API_BASE}/player/update-status`, {
        group,
        oldPlayer,
        newPlayer,
      });

    } catch (err) {
      console.error("UPDATE QUEUE PLAYER ERROR:", err);
    }
  };
// รายชื่อผู้เล่นทั้งหมด
const playerOptionsAll = players.map(p => ({
  value: p.Player_Name,
  label: `${p.Player_Name} (${p.Player_Ranking}) — ${p.Player_Status}`,
  status: p.Player_Status
}));

// รายชื่อที่ใช้เลือก (Active เท่านั้น)
const activePlayerOptions = playerOptionsAll.map(p => ({
  ...p,
  isDisabled: p.status !== "Active"
}));


  return (
    <div className="next-queue-wrapper">
      <div className="queue-header">


        <button onClick={() => navigate(-1)} className="btn-back">
          ⬅ กลับ
        </button>
      </div>

      <div className="queue-grid">
        {nextMatches.length === 0 && (
          <div className="empty">ยังไม่มีคิวแมตช์</div>
        )}

        {nextMatches.map((m, index) => (
          <div key={index} className="next-item">

            {/* TEAM 1 */}
            <div className="team-block">
              <div className="team-row">

                {/* P1 Autocomplete */}
                <Select
                  className="edit-select"
                  value={activePlayerOptions.find(o => o.value === m.p1) || null}
                  onChange={(opt) => updateField(index, "p1", opt?.value || "")}
                  options={activePlayerOptions}
                  placeholder="เลือกผู้เล่น..."
                  isSearchable
                />

                {/* P2 Autocomplete */}
            <Select
  className="edit-select"
  value={playerOptionsAll.find(o => o.value === m.p1) || null}
  onChange={(opt) => updateField(index, "p1", opt?.value || "")}
  options={activePlayerOptions}
  placeholder="เลือกผู้เล่น..."
  isSearchable
/>

              </div>

              <div className="vs">VS</div>

              {/* TEAM 2 */}
              <div className="team-row">

                {/* P3 Autocomplete */}
                <Select
                  className="edit-select"
                  value={activePlayerOptions.find(o => o.value === m.p3) || null}
                  onChange={(opt) => updateField(index, "p3", opt?.value || "")}
                  options={activePlayerOptions}
                  placeholder="เลือกผู้เล่น..."
                  isSearchable
                />

                {/* P4 Autocomplete */}
                <Select
                  className="edit-select"
                  value={activePlayerOptions.find(o => o.value === m.p4) || null}
                  onChange={(opt) => updateField(index, "p4", opt?.value || "")}
                  options={activePlayerOptions}
                  placeholder="เลือกผู้เล่น..."
                  isSearchable
                />
              </div>

              {/* COURT */}
              <select
                className="court-select"
                value={m.court}
                onChange={(e) => updateField(index, "court", e.target.value)}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                  <option key={c} value={c}>
                    Court {c}
                  </option>
                ))}
              </select>

              <div className="buttons">
                <button className="btn-start" onClick={() => startMatch(m, index)}>
                  ▶ Start
                </button>

                <button
                  className="queue-delete"
                  onClick={() =>
                    setNextMatches((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  ✖ Remove
                </button>
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
};

export default NextMatchQueue;
