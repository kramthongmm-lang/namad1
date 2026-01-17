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
import { API_BASE } from "./config";   // <<< ใช้แบบนี้
const Match = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [nextMatch, setNextMatch] = useState(null); // แมตที่รอเริ่ม (Queue)
  // Queue หลายแมต
  const [nextMatches, setNextMatches] = useState([]);
  const [queueList, setQueueList] = useState([]);

  // ⛓ Sync Next Match Queue → localStorage
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);




  const username =
    location.state?.username || localStorage.getItem("loginUser");
  const group =
    location.state?.group || localStorage.getItem("selectedGroup");
  useEffect(() => {
    if (!group) return;
    localStorage.setItem("nextMatches_" + group, JSON.stringify(nextMatches));
  }, [nextMatches, group]);
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
        `${API_BASE}/players/${encodeURIComponent(group)}`
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
        `${API_BASE}/matches/${encodeURIComponent(group)}`
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
        `${API_BASE}/matchcount/${encodeURIComponent(group)}`
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

      await axios.post(`${API_BASE}/match/create`, body);

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
      const res = await axios.post(`${API_BASE}/match/end/${id}`);
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
      const res = await axios.delete(`${API_BASE}/match/delete/${id}`);
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
  useEffect(() => {
    const loadQueue = async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/queue/list/${group}`
        );
        if (res.data.success) {
          setQueueList(res.data.queue);  //  ดึงทุกคิว
        }
      } catch (err) {
        console.error("loadQueue error:", err);
      }
    };

    loadQueue();

    const loop = setInterval(loadQueue, 2000); // realtime
    return () => clearInterval(loop);

  }, [group]);
  const updateQueueField = async (id, field, value) => {
    try {
      await axios.post(`${API_BASE}/queue/update`, {
        id,
        field,
        value
      });
    } catch (err) {
      console.error("queue update error:", err);
    }
  };
// ⭐ ดึงประวัติทั้งหมด + จำนวนครั้ง + ทีมเดียวกันหรือไม่
const getPlayerHistoryDetail = (playerName) => {
  const history = {};

  matches.forEach(m => {
    const team1 = [m.P1, m.P2];
    const team2 = [m.P3, m.P4];
    const all = [...team1, ...team2];

    if (!all.includes(playerName)) return;

    all.forEach(other => {
      if (!other || other === playerName) return;

      if (!history[other]) {
        history[other] = { count: 0, sameTeam: false };
      }

      history[other].count++;

      const sameTeam =
        (team1.includes(playerName) && team1.includes(other)) ||
        (team2.includes(playerName) && team2.includes(other));

      history[other].sameTeam = sameTeam;
    });
  });

  return Object.entries(history).map(([name, data]) => ({
    name,
    count: data.count,
    sameTeam: data.sameTeam,
  }));
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
        <button
          className="btn-nextqueue"
          onClick={() => navigate(`/nextqueue/${group}`)}
        >
          📋 เปิดหน้าคิวแมตช์
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

  <div>🟠 Wait: <b>{players.filter(p => p.Player_Status === "Wait").length}</b></div>
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
        {/* PLAYER GAME COUNT */}
        {/* PLAYER GAME COUNT */}
        {/* PLAYER GAME COUNT */}
        {/* PLAYER GAME COUNT */}
        {/* PLAYER GAME COUNT */}
        {/* PLAYER GAME COUNT */}
        <div className="summary-card">
          <h4 className="ps-title">จำนวนเกมตามเวลา</h4>

          <div className="columns-container">
            {(() => {
              const playerStats = {};

              // รวมจำนวนเกม
              matches.forEach(m => {
                const time = new Date(m.TimeStamp || m.Time_Start).getTime();

                [m.P1, m.P2, m.P3, m.P4].forEach(p => {
                  if (!p) return;

                  if (!playerStats[p]) {
                    playerStats[p] = {
                      name: p,
                      count: 0,
                      earliest: time
                    };
                  }

                  playerStats[p].count += 1;

                  // เพื่อเรียงตามเวลาเริ่มเล่นแรกสุด
                  if (time < playerStats[p].earliest) {
                    playerStats[p].earliest = time;
                  }
                });
              });

              let sorted = Object.values(playerStats);

              if (sorted.length === 0) {
                return <div>ยังไม่มีข้อมูลการเล่น</div>;
              }

              // ? เรียงตามจำนวนเกม น้อย  มาก
              sorted = sorted.sort((a, b) => a.count - b.count);

              // จัดอันดับสีตามจำนวนเกม
              const counts = sorted.map(p => p.count);
              const uniqueSortedCounts = [...new Set(counts)].sort((a, b) => a - b);

              const min1 = uniqueSortedCounts[0];
              const min2 = uniqueSortedCounts[1];
              const min3 = uniqueSortedCounts[2];
              const max = uniqueSortedCounts[uniqueSortedCounts.length - 1];

              const getRankColor = (count) => {
                if (count === min1) return "rank-red";
                if (count === min2) return "rank-orange";
                if (count === min3) return "rank-gold";
                if (count === max) return "rank-green";
                return "rank-gray";
              };

              // แบ่งกลุ่มละ 15 คน (column ละ 15 คน)
              const chunk = (arr, size) => {
                const result = [];
                for (let i = 0; i < arr.length; i += size) {
                  result.push(arr.slice(i, i + size));
                }
                return result;
              };

              const grouped = chunk(sorted, 15);

              return grouped.map((group, colIndex) => (
                <div className="column" key={colIndex}>
                  {group.map((p, i) => {
                    const classColor = getRankColor(p.count);

                    return (
                      <div key={i} className={`rank-item ${classColor}`}>
                        <span className="rank-name">{p.name}</span>
                        <span className="rank-score">{p.count} เกม</span>
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        </div>



        <div className="player-status-wrapper">
          <h3 className="ps-header">จำนวนเวลารอลงสนาม</h3>



          {(() => {
            if (!matches || matches.length === 0) {
              return <div>ยังไม่มีข้อมูลแมตช์</div>;
            }

            const toMs = (val) => {
              if (!val) return NaN;
              if (!isNaN(val)) {
                const num = Number(val);
                if (num < 1e12) return num * 1000;
                return num;
              }
              const t = new Date(val).getTime();
              return Number.isFinite(t) ? t : NaN;
            };

            const toMMSS = (end) => {
              if (!Number.isFinite(end)) return { text: "-", sec: 0 };

              let sec = Math.floor((now - end) / 1000);
              if (sec < 0) sec = 0;

              const mm = Math.floor(sec / 60).toString().padStart(2, "0");
              const ss = (sec % 60).toString().padStart(2, "0");
              return { text: `${mm}:${ss}`, sec };
            };

            const lastEnd = {};

            matches.forEach((m) => {
              const start = new Date(m.created_at).getTime();
              const end = toMs(m.EndTime);

              [m.P1, m.P2, m.P3, m.P4].forEach((p) => {
                if (!p) return;
                if (!lastEnd[p] || start > lastEnd[p].start) {
                  lastEnd[p] = { start, end };
                }
              });
            });

            const playersInQueue = new Set();
            queueList.forEach((q) => {
              [q.P1, q.P2, q.P3, q.P4].forEach((p) => {
                if (p) playersInQueue.add(p);
              });
            });

            const getColor = (name, sec, hasMatch) => {
              const p = players.find((x) => x.Player_Name === name);

              if (p?.Player_Status === "Play") return "green";
              if (playersInQueue.has(name)) return "yellow";
              if (hasMatch && sec >= 20 * 60) return "red";
              return "gray";
            };

            const getStatusText = (name, sec, hasMatch) => {
              const p = players.find((x) => x.Player_Name === name);

              if (p?.Player_Status === "Play") return "กำลังเล่น";
              if (playersInQueue.has(name)) return "รอลงสนาม";
              if (hasMatch && sec >= 20 * 60) return "เกิน 20 นาที";
              return hasMatch ? "ปกติ" : "ยังไม่เคยเล่น";
            };

            // ?? แบ่ง array เป็นชุดละ 10 คน
            const chunk = (arr, size) => {
              const result = [];
              for (let i = 0; i < arr.length; i += size) {
                result.push(arr.slice(i, i + size));
              }
              return result;
            };

            const groupedPlayers = chunk(players, 15);

            return (
              <div className="columns-container">
                {groupedPlayers.map((group, col) => (
                  <div className="column" key={col}>
                    {group.map((pl, idx) => {
                      const name = pl.Player_Name;
                      const d = lastEnd[name];

                      let mmss = { text: "-", sec: 0 };
                      let hasMatch = false;

                      if (d && Number.isFinite(d.end)) {
                        mmss = toMMSS(d.end);
                        hasMatch = true;
                      }

                      const color = getColor(name, mmss.sec, hasMatch);
                      const status = getStatusText(name, mmss.sec, hasMatch);

                      return (
                        <div key={idx} className={`ps-item ${color}`}>
                          <span className="ps-name">{name}</span>
                          <span className="ps-time">{mmss.text}</span>
                          <span className="ps-state">{status}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
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
                          <option key={p.Player_Name} value={p.Player_Name}>
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
                          <option key={p.Player_Name} value={p.Player_Name}>
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
                          <option key={p.Player_Name} value={p.Player_Name}>
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
                          <option key={p.Player_Name} value={p.Player_Name}>
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




          {/* RANDOM PANEL */}
          <RandomPanel
            players={players}
            matchCount={matchCount}
            group={group}
            openPreview={openPreview}
            openPreviewMulti={openPreviewMulti}


          />  
      {showPreview && previewMatch && (
  <div className="preview-panel-compact">

    <h3>ยืนยัน / แก้ไข Match</h3>

    <div className="match-row">

      {/* TEAM 1 */}
      <div className="team-box">
        <b>TEAM 1</b>

        {/* P1 */}
        <select
          value={previewMatch.p1}
          onChange={e =>
            setPreviewMatch({
              ...previewMatch,
              p1: e.target.value,
              r1: getPlayerInfo(e.target.value).rank
            })
          }
        >
          {players.map(p => (
            <option key={p.Player_Name} value={p.Player_Name}>
              {p.Player_Name} ({p.Player_Ranking})
            </option>
          ))}
        </select>

        {/* ⭐ ประวัติ P1 */}
        {previewMatch.p1 && (
          <div className="history-box">
            <div className="history-title">ประวัติที่เคยเจอ:</div>

            {getPlayerHistoryDetail(previewMatch.p1).length === 0 ? (
              <div className="history-item">ยังไม่เคยเจอใคร</div>
            ) : (
              getPlayerHistoryDetail(previewMatch.p1).map((h, i) => (
                <div
                  key={i}
                  className={`history-item ${
                    h.sameTeam ? "history-green" : "history-red"
                  }`}
                >
                  - {h.name} ( {h.count} ครั้ง ) ·{" "}
                  {h.sameTeam ? "ทีมเดียวกัน" : "ตรงข้าม"}
                </div>
              ))
            )}
          </div>
        )}

        {/* P2 */}
        <select
          value={previewMatch.p2}
          onChange={e =>
            setPreviewMatch({
              ...previewMatch,
              p2: e.target.value,
              r2: getPlayerInfo(e.target.value).rank
            })
          }
        >
          {players.map(p => (
            <option key={p.Player_Name} value={p.Player_Name}>
              {p.Player_Name} ({p.Player_Ranking})
            </option>
          ))}
        </select>

        {/* ⭐ ประวัติ P2 */}
        {previewMatch.p2 && (
          <div className="history-box">
            <div className="history-title">ประวัติที่เคยเจอ:</div>

            {getPlayerHistoryDetail(previewMatch.p2).length === 0 ? (
              <div className="history-item">ยังไม่เคยเจอใคร</div>
            ) : (
              getPlayerHistoryDetail(previewMatch.p2).map((h, i) => (
                <div
                  key={i}
                  className={`history-item ${
                    h.sameTeam ? "history-green" : "history-red"
                  }`}
                >
                  - {h.name} ( {h.count} ครั้ง ) ·{" "}
                  {h.sameTeam ? "ทีมเดียวกัน" : "ตรงข้าม"}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="vs-text">VS</div>

      {/* TEAM 2 */}
      <div className="team-box">
        <b>TEAM 2</b>

        {/* P3 */}
        <select
          value={previewMatch.p3}
          onChange={e =>
            setPreviewMatch({
              ...previewMatch,
              p3: e.target.value,
              r3: getPlayerInfo(e.target.value).rank
            })
          }
        >
          {players.map(p => (
            <option key={p.Player_Name} value={p.Player_Name}>
              {p.Player_Name} ({p.Player_Ranking})
            </option>
          ))}
        </select>

        {/* ⭐ ประวัติ P3 */}
        {previewMatch.p3 && (
          <div className="history-box">
            <div className="history-title">ประวัติที่เคยเจอ:</div>

            {getPlayerHistoryDetail(previewMatch.p3).length === 0 ? (
              <div className="history-item">ยังไม่เคยเจอใคร</div>
            ) : (
              getPlayerHistoryDetail(previewMatch.p3).map((h, i) => (
                <div
                  key={i}
                  className={`history-item ${
                    h.sameTeam ? "history-green" : "history-red"
                  }`}
                >
                  - {h.name} ( {h.count} ครั้ง ) ·{" "}
                  {h.sameTeam ? "ทีมเดียวกัน" : "ตรงข้าม"}
                </div>
              ))
            )}
          </div>
        )}

        {/* P4 */}
        <select
          value={previewMatch.p4}
          onChange={e =>
            setPreviewMatch({
              ...previewMatch,
              p4: e.target.value,
              r4: getPlayerInfo(e.target.value).rank
            })
          }
        >
          {players.map(p => (
            <option key={p.Player_Name} value={p.Player_Name}>
              {p.Player_Name} ({p.Player_Ranking})
            </option>
          ))}
        </select>

        {/* ⭐ ประวัติ P4 */}
        {previewMatch.p4 && (
          <div className="history-box">
            <div className="history-title">ประวัติที่เคยเจอ:</div>

            {getPlayerHistoryDetail(previewMatch.p4).length === 0 ? (
              <div className="history-item">ยังไม่เคยเจอใคร</div>
            ) : (
              getPlayerHistoryDetail(previewMatch.p4).map((h, i) => (
                <div
                  key={i}
                  className={`history-item ${
                    h.sameTeam ? "history-green" : "history-red"
                  }`}
                >
                  - {h.name} ( {h.count} ครั้ง ) ·{" "}
                  {h.sameTeam ? "ทีมเดียวกัน" : "ตรงข้าม"}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* COURT */}
      <div className="court-box">
        <b>Court</b>
        <select
          value={previewMatch.court}
          onChange={e =>
            setPreviewMatch({
              ...previewMatch,
              court: e.target.value
            })
          }
        >
          {[1,2,3,4,5,6,7,8].map(c => (
            <option key={c} value={c}>Court {c}</option>
          ))}
        </select>
      </div>
    </div>


  



              {/* BUTTONS */}
              <div className="action-buttons">

                <button
                  className="btn green"
                  onClick={() => {
                    confirmCreateMatch(previewMatch);
                    setPreviewMatch(null);
                    setShowPreview(false);
                  }}
                >
                  ▶ Start
                </button>

                <button
                  className="btn blue"
                  onClick={async () => {
                    await axios.post(`${API_BASE}/queue/add`, {
                      group,
                      p1: previewMatch.p1,
                      p2: previewMatch.p2,
                      p3: previewMatch.p3,
                      p4: previewMatch.p4,
                      r1: previewMatch.r1,
                      r2: previewMatch.r2,
                      r3: previewMatch.r3,
                      r4: previewMatch.r4,
                      court: previewMatch.court,
                      added_by: username
                    });

                    setNextMatches(prev => [...prev, previewMatch].slice(0, 10));
                    setShowPreview(false);
                  }}
                >
                  ➕ คิวถัดไป
                </button>

                <button
                  className="btn red"
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


          {queueList.length > 0 && (
            <div className="next-match-box">

              <h3>? คิวแมตช์ถัดไป ({queueList.length}/10)</h3>

              {queueList.map((q, index) => (
                <div key={q.id} className="next-match-item">

                  {/* ข้อมูลแมต */}
                  <div className="next-match-info">

                    {/* TEAM 1 */}
                    <div className="team">
                      <select
                        value={q.P1}
                        onChange={(e) =>
                          updateQueueField(q.id, "P1", e.target.value)
                        }
                      >
                        {players.map((p) => (
                          <option key={p.Player_Name} value={p.Player_Name}>
                            {p.Player_Name}
                          </option>
                        ))}
                      </select>

                      <select
                        value={q.P2}
                        onChange={(e) =>
                          updateQueueField(q.id, "P2", e.target.value)
                        }
                      >
                        {players.map((p) => (
                          <option key={p.Player_Name} value={p.Player_Name}>
                            {p.Player_Name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="vs">vs</div>

                    {/* TEAM 2 */}
                    <div className="team">
                      <select
                        value={q.P3}
                        onChange={(e) =>
                          updateQueueField(q.id, "P3", e.target.value)
                        }
                      >
                        {players.map((p) => (
                          <option key={p.Player_Name} value={p.Player_Name}>
                            {p.Player_Name}
                          </option>
                        ))}
                      </select>

                      <select
                        value={q.P4}
                        onChange={(e) =>
                          updateQueueField(q.id, "P4", e.target.value)
                        }
                      >
                        {players.map((p) => (
                          <option key={p.Player_Name} value={p.Player_Name}>
                            {p.Player_Name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* COURT */}
                    <div className="court-info">
                      <select
                        value={q.Court || ""}
                        onChange={(e) =>
                          updateQueueField(q.id, "Court", e.target.value)
                        }
                      >
                        <option value="">เลือกคอร์ท</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                          <option key={c} value={c}>Court {c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="queue-actions">

                    {/* START BUTTON */}
                    <button
                      className="btn-start-next"
                      onClick={async () => {
                        await axios.post(`${API_BASE}/match/start`, {
                          group,
                          p1: q.P1,
                          p2: q.P2,
                          p3: q.P3,
                          p4: q.P4,
                          r1: q.R1,
                          r2: q.R2,
                          r3: q.R3,
                          r4: q.R4,
                          court: q.Court
                        });



                        await axios.post(`${API_BASE}/queue/remove`, {
                          id: q.id
                        });
                      }}
                    >
                      Start
                    </button>

                    {/* DELETE BUTTON */}
                    <button
                      className="btn-delete"
                      onClick={async () => {
                        if (!window.confirm("ต้องการลบคิวนี้หรือไม่?")) return;

                        await axios.post(`${API_BASE}/queue/remove`, {
                          id: q.id
                        });
                      }}
                    >
                      ? ลบ
                    </button>

                  </div>
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
