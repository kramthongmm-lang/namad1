// src/components/RandomPanel.js
import React, { useState } from "react";
import { useCourtManager } from "./CourtManager";

/* RANK / RULE config */
const RANK_SCORES = { Baby: 1, BG: 3, NB: 5, N: 10, S: 15 };
const ALLOWED_BASE = {
  Baby: ["Baby", "BG"],
  BG: ["Baby", "NB"],
  NB: ["BG", "N"],
  N: ["NB", "S"],
  S: ["N"],
};

const displayName = (p, matchCount) => `${p.Player_Name} (${p.Player_Ranking}) — ${matchCount?.[p.Player_Name] || 0} Match`;

const RandomPanel = ({ players = [], matchCount = {}, partnerHistory = {}, opponentHistory = {}, openPreview }) => {
  const activePlayers = players.filter((p) => String(p.Player_Status).toLowerCase() === "active");

  const [mode, setMode] = useState("");
  const [selectedP1, setSelectedP1] = useState("");
  const [selectedP2, setSelectedP2] = useState("");
  const [court, setCourt] = useState(1);

  const [fixedPairs, setFixedPairs] = useState([]);
  const [fixedA, setFixedA] = useState("");
  const [fixedB, setFixedB] = useState("");

  // Court manager hook; pass onStartMatch so when court actually starts we call openPreview
  const {
    courtStatus,
    courtQueue,
    handleMatchDispatch,
    finishCourt,
  } = useCourtManager({ courts: 8, onStartMatch: openPreview });

  // Utilities (same as earlier)
  const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const getScore = (rank) => RANK_SCORES[rank] || 0;
  const allowedPartnerRanks = (rank) => { const base = ALLOWED_BASE[rank] ? [...ALLOWED_BASE[rank]] : []; if (!base.includes(rank)) base.push(rank); return base; };
  const hasPartnerBefore = (a, b) => (partnerHistory?.[a]?.[b] || 0) > 0;
  const hasOpponentBefore = (a, b) => (opponentHistory?.[a]?.[b] || 0) > 0;

  const addFixedPair = () => {
    if (!fixedA || !fixedB) return alert("กรุณาเลือกทั้งสองคน");
    if (fixedA === fixedB) return alert("เลือกคนซ้ำกันไม่ได้");
    if (fixedPairs.some(p => p.includes(fixedA) || p.includes(fixedB))) return alert("คนนี้ถูกล๊อคอยู่แล้ว");
    setFixedPairs([...fixedPairs, [fixedA, fixedB]]);
    setFixedA(""); setFixedB("");
  };
  const removeFixedPair = (pair) => setFixedPairs(fixedPairs.filter(p => p !== pair));
  const isFixed = (name) => fixedPairs.some(p => p.includes(name));
  const getFixedPartner = (name) => { for (const pair of fixedPairs) if (pair.includes(name)) return pair.find(x => x !== name); return null; };
  const avoidSoloFixed = (names) => { for (const pair of fixedPairs) { const hasA = names.includes(pair[0]); const hasB = names.includes(pair[1]); if (hasA !== hasB) return false; } return true; };

  // Build result similar shape used earlier
  const buildResult = (p1, p2, p3, p4, partnerRepeats = [], opponentRepeats = []) => {
    const highlight = {};
    [p1, p2, p3, p4].forEach(pl => { highlight[pl.Player_Name] = { partnerRepeat: false, opponentRepeat: false }; });
    partnerRepeats.forEach(pair => { const [a,b] = pair.split("-"); if (highlight[a]) highlight[a].partnerRepeat = true; if (highlight[b]) highlight[b].partnerRepeat = true; });
    opponentRepeats.forEach(pair => { const [a,b] = pair.split("-"); if (highlight[a]) highlight[a].opponentRepeat = true; if (highlight[b]) highlight[b].opponentRepeat = true; });
    return { p1: p1.Player_Name, p2: p2.Player_Name, p3: p3.Player_Name, p4: p4.Player_Name, court, flags: { partnerRepeats, opponentRepeats }, highlight };
  };

  // MODE 1 (P1 chosen -> random P2,P3,P4)
  const findMatchForP1 = (p1Name) => {
    const P1 = activePlayers.find(p => p.Player_Name === p1Name);
    if (!P1) return null;
    let p2Candidates = activePlayers.filter(p => p.Player_Name !== P1.Player_Name && allowedPartnerRanks(P1.Player_Ranking).includes(p.Player_Ranking));
    if (!p2Candidates.length) return null;
    p2Candidates = shuffle(p2Candidates);
    let best = null; let bestR = Infinity;
    for (const P2 of p2Candidates) {
      const target = getScore(P1.Player_Ranking) + getScore(P2.Player_Ranking);
      const pool = shuffle(activePlayers.filter(p => p.Player_Name !== P1.Player_Name && p.Player_Name !== P2.Player_Name));
      for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
        const p3 = pool[i], p4 = pool[j];
        const ok = allowedPartnerRanks(p3.Player_Ranking).includes(p4.Player_Ranking) || allowedPartnerRanks(p4.Player_Ranking).includes(p3.Player_Ranking);
        if (!ok) continue;
        if (getScore(p3.Player_Ranking) + getScore(p4.Player_Ranking) !== target) continue;
        const pr = [], or = [];
        if (hasPartnerBefore(P1.Player_Name, P2.Player_Name)) pr.push(`${P1.Player_Name}-${P2.Player_Name}`);
        if (hasPartnerBefore(p3.Player_Name, p4.Player_Name)) pr.push(`${p3.Player_Name}-${p4.Player_Name}`);
        [[P1,p3],[P1,p4],[P2,p3],[P2,p4]].forEach(([a,b])=>{ if (hasOpponentBefore(a.Player_Name,b.Player_Name)) or.push(`${a.Player_Name}-${b.Player_Name}`); });
        const r = pr.length + or.length;
        if (r === 0) return buildResult(P1,P2,p3,p4,pr,or);
        if (r < bestR) { bestR = r; best = buildResult(P1,P2,p3,p4,pr,or); }
      }
    }
    return best;
  };

  // MODE 2 (P1,P2 chosen -> random P3,P4)
  const findMatchForP1P2 = (p1Name, p2Name) => {
    if (!p1Name || !p2Name) return null;
    if (p1Name === p2Name) return null;
    const P1 = activePlayers.find(p => p.Player_Name === p1Name);
    const P2 = activePlayers.find(p => p.Player_Name === p2Name);
    if (!P1 || !P2) return null;
    const target = getScore(P1.Player_Ranking) + getScore(P2.Player_Ranking);
    const pool = shuffle(activePlayers.filter(p => p.Player_Name !== p1Name && p.Player_Name !== p2Name));
    let best = null; let bestR = Infinity;
    for (let i=0;i<pool.length;i++) for (let j=i+1;j<pool.length;j++){
      const p3 = pool[i], p4 = pool[j];
      const ok = allowedPartnerRanks(p3.Player_Ranking).includes(p4.Player_Ranking) || allowedPartnerRanks(p4.Player_Ranking).includes(p3.Player_Ranking);
      if (!ok) continue;
      if (getScore(p3.Player_Ranking) + getScore(p4.Player_Ranking) !== target) continue;
      const pr = [], or = [];
      if (hasPartnerBefore(p1Name,p2Name)) pr.push(`${p1Name}-${p2Name}`);
      if (hasPartnerBefore(p3.Player_Name,p4.Player_Name)) pr.push(`${p3.Player_Name}-${p4.Player_Name}`);
      [[P1,p3],[P1,p4],[P2,p3],[P2,p4]].forEach(([a,b])=>{ if (hasOpponentBefore(a.Player_Name,b.Player_Name)) or.push(`${a.Player_Name}-${b.Player_Name}`); });
      const r = pr.length + or.length;
      if (r===0) return buildResult(P1,P2,p3,p4,pr,or);
      if (r<bestR){ bestR=r; best=buildResult(P1,P2,p3,p4,pr,or); }
    }
    return best;
  };

  // MODE 3 (fixed pair) uses fixedPairs list (see earlier)
  const findMatchForFixedPair = (p1Name, p2Name) => {
    const P1 = activePlayers.find(p=>p.Player_Name===p1Name);
    const P2 = activePlayers.find(p=>p.Player_Name===p2Name);
    if(!P1||!P2) return null;
    const target = getScore(P1.Player_Ranking)+getScore(P2.Player_Ranking);
    const others = activePlayers.filter(p=>!isFixed(p.Player_Name));
    const pool = shuffle(others);
    let best=null,bestR=Infinity;
    for(let i=0;i<pool.length;i++) for(let j=i+1;j<pool.length;j++){
      const p3 = pool[i], p4 = pool[j];
      const ok = allowedPartnerRanks(p3.Player_Ranking).includes(p4.Player_Ranking) || allowedPartnerRanks(p4.Player_Ranking).includes(p3.Player_Ranking);
      if(!ok) continue;
      if(getScore(p3.Player_Ranking)+getScore(p4.Player_Ranking)!==target) continue;
      const pr = [], or = [];
      if(hasPartnerBefore(p1Name,p2Name)) pr.push(`${p1Name}-${p2Name}`);
      if(hasPartnerBefore(p3.Player_Name,p4.Player_Name)) pr.push(`${p3.Player_Name}-${p4.Player_Name}`);
      [[P1,p3],[P1,p4],[P2,p3],[P2,p4]].forEach(([a,b])=>{ if(hasOpponentBefore(a.Player_Name,b.Player_Name)) or.push(`${a.Player_Name}-${b.Player_Name}`); });
      const r = pr.length+or.length;
      if(r===0) return buildResult(P1,P2,p3,p4,pr,or);
      if(r<bestR){bestR=r;best=buildResult(P1,P2,p3,p4,pr,or);}
    }
    return best;
  };

  // ---- Run handlers: produce match -> dispatch to court manager
  const runRandom = () => {
    const match = findMatchForP1(selectedP1);
    if (!match) return alert("ไม่พบคู่ที่ตรงเงื่อนไข");
    // dispatch to court manager (this will call openPreview when match actually starts)
    const result = handleMatchDispatch({ ...match, court });
    if (result.action === "enqueued") {
      alert(`Court ${result.court} กำลังไม่ว่าง — แมทถูกเพิ่มเข้าแถว (reason: ${result.reason})`);
    }
  };

  const runRandom2 = () => {
    if (!selectedP1 || !selectedP2) return alert("กรุณาเลือก P1 และ P2");
    const match = findMatchForP1P2(selectedP1, selectedP2);
    if (!match) return alert("ไม่พบคู่ที่ตรงเงื่อนไข");
    const result = handleMatchDispatch({ ...match, court });
    if (result.action === "enqueued") {
      alert(`Court ${result.court} กำลังไม่ว่าง — แมทถูกเพิ่มเข้าแถว (reason: ${result.reason})`);
    }
  };

  const runRandom3 = () => {
    if (fixedPairs.length === 0) return alert("ยังไม่มีคู่ล๊อค");
    const [p1Name,p2Name] = fixedPairs[0];
    const match = findMatchForFixedPair(p1Name,p2Name);
    if(!match) return alert("ไม่พบคู่ที่สุ่มได้");
    const result = handleMatchDispatch({ ...match, court });
    if (result.action === "enqueued") {
      alert(`Court ${result.court} กำลังไม่ว่าง — แมทถูกเพิ่มเข้าแถว (reason: ${result.reason})`);
    }
  };

  const clearP1 = () => { setSelectedP1(""); setSelectedP2(""); };
  const addFixed = () => addFixedPair();
  const removeFixed = (pair) => removeFixedPair(pair);

  // ---------------- UI (trimmed, but includes queue status display)
 return (
  <div className="random-panel">
    <h4>🎲 Random — โหมดสุ่ม</h4>

    <label>เลือกโหมด</label>
    <select value={mode} onChange={(e) => setMode(e.target.value)}>
      <option value="">-- เลือก --</option>
      <option value="mode1">Mode 1 — เลือก P1 → random P2,P3,P4</option>
      <option value="mode2">Mode 2 — เลือก P1,P2 → random P3,P4</option>
      <option value="mode3">Mode 3 — fixed pair random</option>
    </select>

    <label style={{ marginTop: 10 }}>Court</label>
    <select value={court} onChange={(e)=>setCourt(Number(e.target.value))}>
      {[1,2,3,4,5,6,7,8].map(c=>(
        <option key={c} value={c}>{c}</option>
      ))}
    </select>

    {mode==="mode1" && (
      <div style={{marginTop:12}}>
        <label>P1</label>
        <select value={selectedP1} onChange={(e)=>setSelectedP1(e.target.value)}>
          <option value="">-- เลือก --</option>
          {activePlayers.map(p=>(
            <option key={p.Player_Name} value={p.Player_Name}>
              {displayName(p,matchCount)}
            </option>
          ))}
        </select>
      </div>
    )}

    {mode==="mode2" && (
      <div style={{marginTop:12}}>
        <label>P1</label>
        <select value={selectedP1} onChange={(e)=>setSelectedP1(e.target.value)}>
          <option value="">-- เลือก --</option>
          {activePlayers.map(p=>(
            <option key={p.Player_Name} value={p.Player_Name}>
              {displayName(p,matchCount)}
            </option>
          ))}
        </select>

        <label style={{marginTop:6}}>P2</label>
        <select value={selectedP2} onChange={(e)=>setSelectedP2(e.target.value)}>
          <option value="">-- เลือก --</option>
          {activePlayers
            .filter(p=>p.Player_Name!==selectedP1)
            .map(p=>(
              <option key={p.Player_Name} value={p.Player_Name}>
                {displayName(p,matchCount)}
              </option>
            ))}
        </select>
      </div>
    )}

    {mode==="mode3" && (
      <div style={{marginTop:12}}>
        <p>โหมด 3 จะสุ่มคู่ตรงข้ามให้คู่ล๊อค ตัวอย่างจะเลือกคู่แรกใน list</p>
      </div>
    )}

    <div style={{marginTop:12}}>
      <button onClick={clearP1} style={{marginRight:8}}>♻️ เคลียร์</button>

      <button
        className="btn-random"
        onClick={() => {
          if (mode === "mode1") runRandom();
          else if (mode === "mode2") runRandom2();
          else if (mode === "mode3") runRandom3();
          else alert("กรุณาเลือกโหมด");
        }}
      >
        ⚡ สุ่มตอนนี้
      </button>
    </div>

    <div style={{marginTop:14, borderTop: "1px solid #ddd", paddingTop: 10}}>
      <h4>🔒 Fixed Pairs</h4>

      <label>คนที่ 1</label>
      <select value={fixedA} onChange={(e)=>setFixedA(e.target.value)}>
        <option value="">-- เลือก --</option>
        {activePlayers.map(p=>(
          <option key={p.Player_Name} value={p.Player_Name}>
            {p.Player_Name}
          </option>
        ))}
      </select>

      <label style={{marginTop:6}}>คนที่ 2</label>
      <select value={fixedB} onChange={(e)=>setFixedB(e.target.value)}>
        <option value="">-- เลือก --</option>
        {activePlayers.map(p=>(
          <option key={p.Player_Name} value={p.Player_Name}>
            {p.Player_Name}
          </option>
        ))}
      </select>

      <div style={{marginTop:6}}>
        <button onClick={addFixed}>➕ เพิ่มคู่ล๊อค</button>
      </div>

      <ul style={{marginTop:10}}>
        {fixedPairs.map(pair=>(
          <li key={pair.join('-')}>
            {pair[0]} ❤️ {pair[1]}
            <button
              onClick={() => removeFixed(pair)}
              style={{marginLeft:8}}
            >
              ❌
            </button>
          </li>
        ))}
      </ul>
    </div>

    <div style={{marginTop:14, borderTop: "1px solid #ddd", paddingTop: 10}}>
      <h4>🏟 Court Status & Queues</h4>

      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(4,1fr)',
        gap:8
      }}>
        {Object.keys(courtStatus).map((k)=>(
          <div key={k} style={{
            padding:8,
            border:'1px solid #ccc',
            borderRadius:6
          }}>
            <div><b>Court {k}</b></div>
            <div>Status: {courtStatus[k].status}</div>
            <div>Queue: {(courtQueue[k]||[]).length} waiting</div>

            <div style={{marginTop:6}}>
              <button onClick={() => finishCourt(Number(k))}>
                End Court (simulate)
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
};
export default RandomPanel;
