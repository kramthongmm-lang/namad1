// Combined Clean Optimized RandomPanel.js (fixed2 removed)
import React, { useState } from "react";

const RandomPanel = ({ players = [], matchCount = {}, openPreview, openPreviewMulti }) => {
  const activePlayers = players.filter((p) => p.Player_Status === "Active");

  const [fixedA, setFixedA] = useState("");
  const [fixedB, setFixedB] = useState("");
  const [rankA, setRankA] = useState("");
  const [rankB, setRankB] = useState("");
  const [court, setCourt] = useState(1);
  const [mode, setMode] = useState("");
  const [selectedRank, setSelectedRank] = useState("");

  const rankings = ["BG", "NB", "N", "S", "P"]; // Ranking

  // ------------------------------------------------------------
  // Fisher–Yates Shuffle
  // ------------------------------------------------------------
  const shuffle = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const findPlayer = (name) => activePlayers.find((p) => p.Player_Name === name);

  const playersByRank = (rank, except = []) =>
    activePlayers.filter(
      (p) => p.Player_Ranking === rank && !except.includes(p.Player_Name)
    );

  const validateFixed = () => {
    if (!fixedA || !fixedB) {
      alert("กรุณาเลือก P1/P2");
      return false;
    }
    if (fixedA === fixedB) {
      alert("ห้ามเลือกซ้ำกัน");
      return false;
    }
    return true;
  };

  // ------------------------------------------------------------
  // MODE 1 — Random 4 คน Rank เดียวกัน
  // ------------------------------------------------------------
  const randomSameRank = () => {
    if (!selectedRank) return alert("กรุณาเลือก Ranking");

    const list = playersByRank(selectedRank);
    if (list.length < 4) return alert(`Ranking ${selectedRank} ผู้เล่นไม่ถึง 4 คน`);

    const chosen = shuffle(list).slice(0, 4).map((p) => p.Player_Name);

    openPreview({ p1: chosen[0], p2: chosen[1], p3: chosen[2], p4: chosen[3], court });
  };

  // ------------------------------------------------------------
  // MODE 3 — Ranking vs Ranking  Random P3/P4
  // ------------------------------------------------------------
  const randomByRanking = () => {
    if (!validateFixed()) return;

    const p1 = findPlayer(fixedA);
    const p2 = findPlayer(fixedB);

    if (!p1 || !p2) return alert("ไม่พบข้อมูลผู้เล่นที่เลือก");

    const p3List = playersByRank(p1.Player_Ranking, [fixedA]);
    const p4List = playersByRank(p2.Player_Ranking, [fixedB]);

    if (p3List.length < 1) return alert(`ไม่มีผู้เล่น Rank ${p1.Player_Ranking}`);
    if (p4List.length < 1) return alert(`ไม่มีผู้เล่น Rank ${p2.Player_Ranking}`);

    const p3 = shuffle(p3List)[0].Player_Name;
    const p4 = shuffle(p4List)[0].Player_Name;

    openPreview({ p1: fixedA, p2: fixedB, p3, p4, court });
  };

  // ------------------------------------------------------------
  // MODE 4 — คนที่มาก่อน
  // ------------------------------------------------------------
  const randomFirstCome = () => {
    const sorted = [...activePlayers].sort(
      (a, b) => new Date(a.TimeStamp) - new Date(b.TimeStamp)
    );

    if (sorted.length < 4) return alert("ผู้เล่นไม่ถึง 4 คน");

    const chosen = sorted.slice(0, 4).map((p) => p.Player_Name);

    openPreview({ p1: chosen[0], p2: chosen[1], p3: chosen[2], p4: chosen[3], court });
  };

  // ------------------------------------------------------------
  // MODE 5 — คนที่เล่นน้อยที่สุด
  // ------------------------------------------------------------
  const randomLowestMatch = () => {
    if (!validateFixed()) return;

    const p1 = findPlayer(fixedA);
    const p2 = findPlayer(fixedB);

    if (!p1 || !p2) return alert("ไม่พบข้อมูลผู้เล่นที่เลือก");

    const p3List = playersByRank(p1.Player_Ranking, [fixedA]);
    const p4List = playersByRank(p2.Player_Ranking, [fixedB]);

    if (p3List.length < 1) return alert(`ไม่มีผู้เล่น Rank ${p1.Player_Ranking}`);
    if (p4List.length < 1) return alert(`ไม่มีผู้เล่น Rank ${p2.Player_Ranking}`);

    const p3 = p3List.sort((a, b) => (matchCount[a.Player_Name] || 0) - (matchCount[b.Player_Name] || 0))[0].Player_Name;
    const p4 = p4List.sort((a, b) => (matchCount[a.Player_Name] || 0) - (matchCount[b.Player_Name] || 0))[0].Player_Name;

    openPreview({ p1: fixedA, p2: fixedB, p3, p4, court });
  };

  // ------------------------------------------------------------
  // MODE 6 — Multi Match (1–5)
  // ------------------------------------------------------------
const randomMultiByRank = () => {
if (!fixedA || !fixedB) return alert("กรุณาเลือก P1/P2 ก่อน");


const p1 = findPlayer(fixedA);
const p2 = findPlayer(fixedB);


if (!p1 || !p2) return alert("ไม่พบข้อมูลผู้เล่นที่เลือก");


const listA = playersByRank(p1.Player_Ranking, [p1.Player_Name]);
const listB = playersByRank(p2.Player_Ranking, [p2.Player_Name]);


if (listA.length < 1 || listB.length < 1)
return alert("ไม่พอสำหรับการสุ่ม P3/P4 ตาม Rank ของ P1/P2");


const count = Math.floor(Math.random() * 5) + 1;
const result = [];


for (let i = 0; i < count; i++) {
const p3 = shuffle(listA)[0].Player_Name; // P3 match rank of P1
const p4 = shuffle(listB)[0].Player_Name; // P4 match rank of P2


result.push({
p1: p1.Player_Name,
p2: p2.Player_Name,
p3,
p4,
court,
rankA: p1.Player_Ranking,
rankB: p2.Player_Ranking,
});
}


openPreviewMulti(result)(result);
};

  // ------------------------------------------------------------
  // Mode Mapping
  // ------------------------------------------------------------
  const modes = {
    sameRank: randomSameRank,
    rankSelect: randomByRanking,
    firstCome: randomFirstCome,
    lowestMatch: randomLowestMatch,
    multiByRank: randomMultiByRank
  };

  const runMode = () => {
    if (!modes[mode]) return;
    modes[mode]();
  };

  const getDisplayName = (p) => `${p.Player_Name} (${p.Player_Ranking}) — ${matchCount[p.Player_Name] || 0} Match`;

  return (
    <div className="random-panel">
      <h4>?? Random Players (Active เท่านั้น)</h4>

      <label>Court</label>
      <select value={court} onChange={(e) => setCourt(Number(e.target.value))}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <label style={{ marginTop: 10 }}>เลือกโหมดสุ่ม</label>
      <select value={mode} onChange={(e) => setMode(e.target.value)}>
        <option value="">-- เลือก --</option>
        <option value="sameRank">?? Random 4 คน Rank เดียวกัน</option>
        <option value="rankSelect">?? P1/P2  Random P3/P4 (ตาม Rank)</option>
        <option value="firstCome">? คนที่มาก่อน</option>
        <option value="lowestMatch">?? คนที่เล่นน้อยที่สุด (เลือก P1/P2)</option>
        <option value="multiByRank">?? Multi Match (1–5)</option>
      </select>

      {/* Choose Rank for "Same Rank" */}
      {mode === "sameRank" && (
        <div style={{ marginTop: 8 }}>
          <label>เลือก Ranking</label>
          <select value={selectedRank} onChange={(e) => setSelectedRank(e.target.value)}>
            <option value="">-- เลือก --</option>
            {rankings.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      )}

      {/* MODE rankSelect */}
      {mode === "rankSelect" && (
        <div style={{ marginTop: 10 }}>
          <label>P1</label>
          <select value={fixedA} onChange={(e) => setFixedA(e.target.value)}>
            <option value="">-- เลือก P1 --</option>
            {activePlayers.map((p) => (
              <option key={p.Player_Name} value={p.Player_Name}>
                {getDisplayName(p)}
              </option>
            ))}
          </select>

          <label style={{ marginTop: 6 }}>P2</label>
          <select value={fixedB} onChange={(e) => setFixedB(e.target.value)}>
            <option value="">-- เลือก P2 --</option>
            {activePlayers.map((p) => (
              <option key={p.Player_Name} value={p.Player_Name}>
                {getDisplayName(p)}
              </option>
            ))}
          </select>

          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
            ?? ระบบจะสุ่ม P3 จาก Rank เดียวกับ P1  
            ?? และสุ่ม P4 จาก Rank เดียวกับ P2
          </div>
        </div>
      )}

      {/* MODE lowestMatch */}
      {mode === "lowestMatch" && (
        <div style={{ marginTop: 10 }}>
          <label>P1 (เลือกเอง)</label>
          <select value={fixedA} onChange={(e) => setFixedA(e.target.value)}>
            <option value="">-- เลือก P1 --</option>
            {activePlayers.map((p) => (
              <option key={p.Player_Name} value={p.Player_Name}>
                {getDisplayName(p)}
              </option>
            ))}
          </select>

          <label style={{ marginTop: 6 }}>P2 (เลือกเอง)</label>
          <select value={fixedB} onChange={(e) => setFixedB(e.target.value)}>
            <option value="">-- เลือก P2 --</option>
            {activePlayers.map((p) => (
              <option key={p.Player_Name} value={p.Player_Name}>
                {getDisplayName(p)}
              </option>
            ))}
          </select>

          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
            ?? ระบบจะเลือก P3/P4 ที่ **จำนวน Match น้อยที่สุด**  
            ?? โดย <b>P3 rank = P1 rank</b> และ <b>P4 rank = P2 rank</b>
          </div>
        </div>
      )}

      {/* MODE multiByRank */}
      {mode === "multiByRank" && (
        <div style={{ marginTop: 10 }}>
          <label>Ranking Team 1</label>
          <select value={rankA} onChange={(e) => setRankA(e.target.value)}>
            <option value="">-- เลือก --</option>
            {rankings.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <label style={{ marginTop: 6 }}>Ranking Team 2</label>
          <select value={rankB} onChange={(e) => setRankB(e.target.value)}>
            <option value="">-- เลือก --</option>
            {rankings.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      )}

      {/* RUN BUTTON */}
      <button className="btn-random" style={{ marginTop: 12 }} onClick={runMode}>
        ? เริ่มสุ่มตามโหมดที่เลือก
      </button>
    </div>
  );
};

export default RandomPanel;
