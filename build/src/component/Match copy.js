// Match.js (FULL VERSION — READY TO USE)
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

import PlayerList from "./PlayerList";
import MatchPanel from "./MatchPanel";
import RandomPanel from "./RandomPanel";
import HistoryMatch from "./HistoryMatch";
import "../css/match.css";
import "../css/preview.css";

const Match = () => {
  const location = useLocation();
  const navigate = useNavigate();
const [nextMatch, setNextMatch] = useState(null); // แมตที่รอเริ่ม (Queue)
const [nextMatches, setNextMatches] = useState([]);  // ⭐ Queue หลายแมต
const blockedPlayers = nextMatches.flatMap(m => [m.p1, m.p2, m.p3, m.p4]);

  const username =
    location.state?.username || localStorage.getItem("loginUser");
  const group =
    location.state?.group || localStorage.getItem("selectedGroup");

  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [matchCount, setMatchCount] = useState({});

  // Manual selection
  const [team1_p1, setTeam1P1] = useState("");
  const [team1_p2, setTeam1P2] = useState("");
  const [team2_p1, setTeam2P1] = useState("");
  const [team2_p2, setTeam2P2] = useState("");

  // PREVIEW SINGLE
  const [showPreview, setShowPreview] = useState(false);
  const [previewMatch, setPreviewMatch] = useState(null);

  // PREVIEW MULTI
  const [showMultiPreview, setShowMultiPreview] = useState(false);
  const [multiPreview, setMultiPreview] = useState([]);

  // =====================================================
  // AUTO REFRESH ทุก 2 วิ
  // =====================================================
  useEffect(() => {
    if (!group) return;

    fetchPlayers();
    fetchMatches();
    fetchMatchCount();

    const interval = setInterval(() => {
      fetchPlayers();
      fetchMatches();
      fetchMatchCount();
    }, 2000);

    return () => clearInterval(interval);
  }, [group]);

  // =====================================================
  // LOAD PLAYERS
  // =====================================================
  const fetchPlayers = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/players/${encodeURIComponent(group)}`
      );
      if (res.data.success) setPlayers(res.data.players);
      else setPlayers([]);
    } catch (err) {
      console.error("fetchPlayers error:", err);
      setPlayers([]);
    }
  };

  // =====================================================
  // LOAD MATCHES
  // =====================================================
  const fetchMatches = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/matches/${encodeURIComponent(group)}`
      );
      if (res.data.success) setMatches(res.data.matches);
      else setMatches([]);
    } catch (err) {
      console.error("fetchMatches error:", err);
      setMatches([]);
    }
  };

  // =====================================================
  // LOAD MATCH COUNT
  // =====================================================
  const fetchMatchCount = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/matchcount/${encodeURIComponent(group)}`
      );

      if (res.data.success) {
        const map = {};
        res.data.matchCount.forEach((row) => {
          map[row.Player_Name] = row.matchCount;
        });
        setMatchCount(map);
      }
    } catch (err) {
      console.error("fetchMatchCount error:", err);
    }
  };

  // =====================================================
  // PLAYER INFO HELPER
  // =====================================================
  const getPlayerInfo = (name) => {
    if (!name) return { rank: null, status: null };
    const p = players.find((x) => x.Player_Name === name);
    return {
      rank: p?.Player_Ranking || null,
      status: p?.Player_Status || null,
    };
  };

  // =====================================================
  // OPEN PREVIEW (SINGLE)
  // =====================================================
  const openPreview = ({ p1, p2, p3, p4, court = "" }) => {
    setPreviewMatch({
      p1, p2, p3, p4, court,
      r1: getPlayerInfo(p1).rank,
      r2: getPlayerInfo(p2).rank,
      r3: getPlayerInfo(p3).rank,
      r4: getPlayerInfo(p4).rank,
      s1: getPlayerInfo(p1).status,
      s2: getPlayerInfo(p2).status,
      s3: getPlayerInfo(p3).status,
      s4: getPlayerInfo(p4).status,
      c1: matchCount[p1] || 0,
      c2: matchCount[p2] || 0,
      c3: matchCount[p3] || 0,
      c4: matchCount[p4] || 0,
    });
    setShowPreview(true);
    setShowMultiPreview(false);
  };

  // =====================================================
  // OPEN PREVIEW MULTI
  // =====================================================
  const openPreviewMulti = (list) => {
    const enriched = list.map((m) => ({
      ...m,
      r1: getPlayerInfo(m.p1).rank,
      r2: getPlayerInfo(m.p2).rank,
      r3: getPlayerInfo(m.p3).rank,
      r4: getPlayerInfo(m.p4).rank,
      c1: matchCount[m.p1] || 0,
      c2: matchCount[m.p2] || 0,
      c3: matchCount[m.p3] || 0,
      c4: matchCount[m.p4] || 0,
    }));

    setMultiPreview(enriched);
    setShowMultiPreview(true);
    setShowPreview(false);
  };

  // =====================================================
  // CONFIRM SINGLE MATCH
  // =====================================================
  const confirmCreateMatch = async (data) => {
    const payload = data || previewMatch;
    if (!payload) return;

    try {
      const body = {
        group,
        p1: payload.p1,
        p2: payload.p2,
        p3: payload.p3,
        p4: payload.p4,
        r1: payload.r1,
        r2: payload.r2,
        r3: payload.r3,
        r4: payload.r4,
        status: "Play",
        court: payload.court || 1,
      };

      await axios.post("http://localhost:5000/match/create", body);

      setShowPreview(false);
      setPreviewMatch(null);
      clearManualSelect();

      await fetchPlayers();
      await fetchMatches();
      await fetchMatchCount();
    } catch (err) {
      console.error("confirmCreateMatch error:", err);
    }
  };

  // =====================================================
  // CONFIRM MULTI MATCH
  // =====================================================
  const confirmMultiMatch = async () => {
    for (let m of multiPreview) {
      await confirmCreateMatch(m);
    }
    setShowMultiPreview(false);
    setMultiPreview([]);
  };

  const clearManualSelect = () =>
    (setTeam1P1(""), setTeam1P2(""), setTeam2P1(""), setTeam2P2(""));

  // =====================================================
  // MANUAL CREATE
  // =====================================================
  const handleManualCreate = (court = "") => {
    if (!team1_p1 || !team1_p2 || !team2_p1 || !team2_p2)
      return alert("กรุณาเลือกผู้เล่นให้ครบ 4 คน");

    openPreview({
      p1: team1_p1,
      p2: team1_p2,
      p3: team2_p1,
      p4: team2_p2,
      court,
    });
  };

  // =====================================================
  // END MATCH
  // =====================================================
  const endMatch = async (id) => {
    try {
      const res = await axios.post(`http://localhost:5000/match/end/${id}`);
      if (res.data.success) {
        await fetchPlayers();
        await fetchMatches();
        await fetchMatchCount();
      }
    } catch (err) {
      console.error("endMatch error:", err);
    }
  };

  // =====================================================
  // DELETE MATCH
  // =====================================================
  const deleteMatch = async (id) => {
    if (!window.confirm("ต้องการลบแมตช์นี้ใช่ไหม?")) return;
    try {
      const res = await axios.delete(`http://localhost:5000/match/delete/${id}`);
      if (res.data.success) {
        await fetchMatches();
        await fetchMatchCount();
      }
    } catch (err) {
      console.error("deleteMatch error:", err);
    }
  };

  // =====================================================
  // RENDER UI
  // =====================================================
  const confirmSingleMatch = (index) => {
    const match = multiPreview[index];
    openPreview(match);  // หรือ logic อื่นที่คุณใช้ในการส่งเข้าระบบ

    const newList = multiPreview.filter((_, i) => i !== index);
    setMultiPreview(newList);

    if (newList.length === 0) setShowMultiPreview(false);
  };

  return (
    <div className="match-container">

      {/* HEADER */}
      <div className="match-header">
        <div><b>{username}</b></div>
        <div>Group: <b>{group}</b></div>
        <button
          className="btn-back"
          onClick={() => navigate("/player", { state: { username, group } })}
        >
          กลับหน้า Player
        </button>
      </div>

      {/* DASHBOARD SUMMARY */}
      <div className="match-summary">

        {/* PLAYERS */}
        <div className="summary-card">
          <h4>📌 ผู้เล่น</h4>
          <div>ทั้งหมด: <b>{players.length}</b></div>
          <div>🟢 Active: <b>{players.filter(p => p.Player_Status === "Active").length}</b></div>
          <div>🟡 Play: <b>{players.filter(p => p.Player_Status === "Play").length}</b></div>
        </div>

        {/* RANKING */}
        <div className="summary-card">
          <h4>🏅 Ranking</h4>
          {["BG", "NB", "N", "S", "P"].map(rk => (
            <div key={rk}>{rk}: <b>{players.filter(p => p.Player_Ranking === rk).length}</b></div>
          ))}
        </div>

        {/* COURT STATUS */}
        <div className="summary-card">
          <h4>🎾 Court</h4>

          {(() => {
            const playing = matches.filter(m => m.Match_Status === "Play");
            if (playing.length === 0) return <div>ไม่มีคอร์ทกำลังเล่น</div>;
            return playing.map(m => (
              <div key={m.id}>Court <b>{m.Court}</b> — Match #{m.Match_no}</div>
            ));
          })()}
        </div>
      </div>

      {/* GRID LAYOUT */}
      <div className="match-grid">

        {/* LEFT */}
        <div className="left">
          <PlayerList players={players} matchCount={matchCount} group={group} />
        </div>

        {/* RIGHT */}
        <div className="right">

          {/* ================= MULTI PREVIEW ================= */}
          {showMultiPreview && (
            <div className="preview-side-panel">

              <h3>ยืนยันหลายแมตช์ ({multiPreview.length})</h3>

              {multiPreview.map((m, idx) => (
                <div key={idx} className="preview-multi-item upgraded">

                  <div className="match-header">
                    <b>Match {idx + 1}</b> — Court {m.court}
                  </div>

                  {/* Editable Players */}
                  <div className="team-container">

                    {/* TEAM A */}
                    <div className="team-block">
             <select
  className="edit-select"
  value={m.p1}
  onChange={(e) => {
    const updated = [...multiPreview];
    updated[idx].p1 = e.target.value;

    // อัปเดต rank + match count ถ้าต้องการ
    const p = players.find((x) => x.Player_Name === e.target.value);
    if (p) {
      updated[idx].r1 = p.Player_Ranking;
      updated[idx].c1 = matchCount[p.Player_Name] || 0;
    }

    setMultiPreview(updated);
  }}
>
  <option value="">-- เลือกผู้เล่น --</option>
  {players.map((p) => (
    <option key={p.Player_Name} value={p.Player_Name}   disabled={blockedPlayers.includes(p.Player_Name) && p.Player_Name !== previewMatch.p1} 
>
      
      {p.Player_Name} ({p.Player_Ranking})
    </option>
  ))}
</select>


                      <span className="rank-tag">{m.r1}</span>
                      <span className="match-count">{m.c1} Match</span>

                    <select
  className="edit-select"
  value={m.p2}
  onChange={(e) => {
    const updated = [...multiPreview];
    updated[idx].p2 = e.target.value;

    const p = players.find((x) => x.Player_Name === e.target.value);
    if (p) {
      updated[idx].r2 = p.Player_Ranking;
      updated[idx].c2 = matchCount[p.Player_Name] || 0;
    }

    setMultiPreview(updated);
  }}
>
  <option value="">-- เลือกผู้เล่น --</option>
  {players.map((p) => (
    <option key={p.Player_Name} value={p.Player_Name} disabled={blockedPlayers.includes(p.Player_Name) && p.Player_Name !== previewMatch.p1} >
        

      {p.Player_Name} ({p.Player_Ranking})
    </option>
  ))}
</select>

                      <span className="rank-tag">{m.r2}</span>
                      <span className="match-count">{m.c2} Match</span>
                    </div>

                    <div className="vs">VS</div>

                    {/* TEAM B */}
                    <div className="team-block">
                   <select
  className="edit-select"
  value={m.p3}
  onChange={(e) => {
    const updated = [...multiPreview];
    updated[idx].p3 = e.target.value;

    const p = players.find((x) => x.Player_Name === e.target.value);
    if (p) {
      updated[idx].r3 = p.Player_Ranking;
      updated[idx].c3 = matchCount[p.Player_Name] || 0;
    }

    setMultiPreview(updated);
  }}
>
  <option value="">-- เลือกผู้เล่น --</option>
  {players.map((p) => (
    <option key={p.Player_Name} value={p.Player_Name} disabled={blockedPlayers.includes(p.Player_Name) && p.Player_Name !== previewMatch.p1} >
      {p.Player_Name} ({p.Player_Ranking})

    </option>
  ))}
</select>

                      <span className="rank-tag">{m.r3}</span>
                      <span className="match-count">{m.c3} Match</span>

                    <select
  className="edit-select"
  value={m.p4}
  onChange={(e) => {
    const updated = [...multiPreview];
    updated[idx].p4 = e.target.value;

    const p = players.find((x) => x.Player_Name === e.target.value);
    if (p) {
      updated[idx].r4 = p.Player_Ranking;
      updated[idx].c4 = matchCount[p.Player_Name] || 0;
    }

    setMultiPreview(updated);
  }}
>
  <option value="">-- เลือกผู้เล่น --</option>
  {players.map((p) => (
    <option key={p.Player_Name} value={p.Player_Name} disabled={blockedPlayers.includes(p.Player_Name) && p.Player_Name !== previewMatch.p1} >
      {p.Player_Name} ({p.Player_Ranking})
    </option>
  ))}
</select>

                      <span className="rank-tag">{m.r4}</span>
                      <span className="match-count">{m.c4} Match</span>
                    </div>

                  </div>

                  {/* Action Buttons per Match */}
                  <div className="per-match-buttons">

                    <button
                      className="btn-confirm-one"
                      onClick={() => confirmSingleMatch(idx)}
                    >
                      ? ยืนยันคู่นี้
                    </button>

                    <button
                      className="btn-delete"
                      onClick={() => {
                        const newList = multiPreview.filter((_, i) => i !== idx);
                        setMultiPreview(newList);
                        if (newList.length === 0) setShowMultiPreview(false);
                      }}
                    >
                      ?? ลบคู่
                    </button>
                  </div>

                </div>
              ))}

              {/* Global Action Buttons */}
              <div className="preview-buttons">
                <button className="btn-confirm" onClick={confirmMultiMatch}>
                  ? ยืนยันทั้งหมด
                </button>
                <button
                  className="btn-cancel"
                  onClick={() => {
                    setShowMultiPreview(false);
                    setMultiPreview([]);
                  }}
                >
                  ? ยกเลิก
                </button>
              </div>

            </div>
          )}

          {/* ================= SINGLE PREVIEW ================= */}
       {showPreview && previewMatch && (
  <div className="preview-side-panel">

    <h3>ยืนยัน / แก้ไข Match</h3>

    <div className="team-preview">

      {/* TEAM 1 */}
      <div className="team-col">
        <b>TEAM 1</b>

        {/* PLAYER 1 */}
        <select
          className="preview-select"
          value={previewMatch.p1}
          onChange={(e) =>
            setPreviewMatch({
              ...previewMatch,
              p1: e.target.value,
              r1: getPlayerInfo(e.target.value).rank
            })
          }
        >
          {players.map(p => (
            <option key={p.Player_Name} value={p.Player_Name} disabled={blockedPlayers.includes(p.Player_Name) && p.Player_Name !== previewMatch.p1} >
              {p.Player_Name} ({p.Player_Ranking})
            </option>
          ))}
        </select>

        {/* PLAYER 2 */}
        <select
          className="preview-select"
          value={previewMatch.p2}
          onChange={(e) =>
            setPreviewMatch({
              ...previewMatch,
              p2: e.target.value,
              r2: getPlayerInfo(e.target.value).rank
            })
          }
        >
          {players.map(p => (
            <option key={p.Player_Name} value={p.Player_Name} disabled={blockedPlayers.includes(p.Player_Name) && p.Player_Name !== previewMatch.p1} >
              {p.Player_Name} ({p.Player_Ranking})
            </option>
          ))}
        </select>
      </div>

      <div className="vs">VS</div>

      {/* TEAM 2 */}
      <div className="team-col">
        <b>TEAM 2</b>

        <select
          className="preview-select"
          value={previewMatch.p3}
          onChange={(e) =>
            setPreviewMatch({
              ...previewMatch,
              p3: e.target.value,
              r3: getPlayerInfo(e.target.value).rank
            })
          }
        >
          {players.map(p => (
            <option key={p.Player_Name} value={p.Player_Name} disabled={blockedPlayers.includes(p.Player_Name) && p.Player_Name !== previewMatch.p1} >
              {p.Player_Name} ({p.Player_Ranking})
            </option>
          ))}
        </select>

        <select
          className="preview-select"
          value={previewMatch.p4}
          onChange={(e) =>
            setPreviewMatch({
              ...previewMatch,
              p4: e.target.value,
              r4: getPlayerInfo(e.target.value).rank
            })
          }
        >
          {players.map(p => (
            <option key={p.Player_Name} value={p.Player_Name} disabled={blockedPlayers.includes(p.Player_Name) && p.Player_Name !== previewMatch.p1} >
              {p.Player_Name} ({p.Player_Ranking})
            </option>
          ))}
        </select>
      </div>

    </div>

    {/* COURT SELECTOR */}
    <label style={{ marginTop: 15 }}>เลือก Court</label>
    <select
      className="preview-select"
      value={previewMatch.court}
      onChange={(e) =>
        setPreviewMatch({
          ...previewMatch,
          court: e.target.value
        })
      }
    >
      {[1,2,3,4,5,6,7,8].map(c => (
        <option key={c} value={c}>
          Court {c}
        </option>
      ))}
    </select>

    {/* BUTTONS */}
    <div className="preview-buttons">

      {/* START MATCH */}
      <button
        className="btn-confirm"
        onClick={() => {
          confirmCreateMatch(previewMatch);  // บันทึกแมตช์จริง
          setPreviewMatch(null);             // ลบ preview ออกจาก state
          setShowPreview(false);             // ปิด panel
        }}
      >
        ▶ Start Match
      </button>

      {/* ADD TO NEXT MATCH QUEUE */}
      <button
        className="btn-next"
        onClick={() => {
          setNextMatches(prev => [...prev, previewMatch].slice(0, 10));  

          setShowPreview(false);
        }}
      >
        ➕ เพิ่มเป็นแมตถัดไป
      </button>

      {/* CANCEL */}
      <button
        className="btn-cancel"
        onClick={() => {
          setShowPreview(false);
          setPreviewMatch(null);
        }}
      >
        ✖ ยกเลิก
      </button>

    </div>

  </div>
)}



          {/* RANDOM PANEL */}
          <RandomPanel
            players={players}
            matchCount={matchCount}
            group={group}
            openPreview={openPreview}
            openPreviewMulti={openPreviewMulti}
          />
{nextMatches.length > 0 && (
  <div className="next-match-box">

    <h3>⏳ คิวแมตช์ถัดไป ({nextMatches.length}/10)</h3>

    {nextMatches.map((nm, index) => (
      <div key={index} className="next-match-item">
        
        <div className="next-match-info">
          <div className="team">{nm.p1} / {nm.p2}</div>
          <div className="vs">vs</div>
          <div className="team">{nm.p3} / {nm.p4}</div>
          <div className="court-info">คอร์ท {nm.court}</div>
        </div>

        <button
          className="btn-start-next"
          onClick={async () => {
            await confirmCreateMatch(nm); // ▶ สร้างแมตนี้จริง
            setNextMatches(prev => prev.filter((_, i) => i !== index)); // ❌ ลบออกจากคิว
          }}
        >
          ▶ Start
        </button>
      </div>
    ))}

  </div>
)}

          {/* MANUAL PANEL */}
          <MatchPanel
            players={players}
            group={group}
            matches={matches}
            refreshMatches={fetchMatches}
            onSaved={fetchPlayers}
            team1_p1={team1_p1}
            team1_p2={team1_p2}
            team2_p1={team2_p1}
            team2_p2={team2_p2}
            setTeam1P1={setTeam1P1}
            setTeam1P2={setTeam1P2}
            setTeam2P1={setTeam2P1}
            setTeam2P2={setTeam2P2}
            handleManualCreate={handleManualCreate}
            endMatch={endMatch}
            deleteMatch={deleteMatch}
            getPlayerInfo={getPlayerInfo}
          />

        </div>
      </div>

      {/* HISTORY */}
  

    </div>
  );
};

export default Match;
