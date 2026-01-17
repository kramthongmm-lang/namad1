// Match.js (FULL VERSION — READY TO USE)
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import Select from "react-select";
import { io } from "socket.io-client";
import socket from "./socket";


import MatchPanel from "./MatchPanel";
import RandomPanel from "./RandomPanel";
import HistoryMatch from "./HistoryMatch";
import "../css/match.css";
import "../css/preview.css";
import { API_BASE } from "./config";   // <<< ใช้แบบนี้
const Match = () => {
  const socket = io(API_BASE);
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
const [countdown, setCountdown] = useState(5);

  // PREVIEW SINGLE
  // PREVIEW SUPPORT MULTI-MATCH
  const [showPreview, setShowPreview] = useState(false);
  const [previewMatches, setPreviewMatches] = useState([]);
  const [previewMatch, setPreviewMatch] = useState(null);
  const m = previewMatches[0];
const [courts, setCourts] = useState([]);
const autoQueuedRef = React.useRef(false);

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
useEffect(() => {
  if (!showPreview) return;
  if (!previewMatches || previewMatches.length === 0) return;
  if (autoQueuedRef.current) return;

  autoQueuedRef.current = true;

  const timer = setTimeout(() => {
    console.log("⏱ Auto Queue Next (5s)");
    autoQueueNext();
  }, 5000);

  return () => clearTimeout(timer);
}, [showPreview]);

useEffect(() => {
  const onRefresh = () => {
    console.log("🔄 SOCKET REFRESH");
    fetchCourts();
    fetchPlayers();
    fetchMatches();
  };

  socket.on("refresh", onRefresh);

  return () => {
    socket.off("refresh", onRefresh); // 🔥 สำคัญมาก
  };
}, []);

const fetchCourts = async () => {
  try {
    const res = await axios.get(`${API_BASE}/court/${group}`);
    if (res.data.success) {
      setCourts(res.data.courts);
    }
  } catch (err) {
    console.error("FETCH COURTS ERROR:", err);
  }
};
useEffect(() => {
  fetchCourts();
}, [group]);
useEffect(() => {
  fetchCourts();
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
  const updateMatch = (idx, data) => {
    const updated = [...previewMatches];
    updated[idx] = {
      ...updated[idx],
      ...data
    };
    setPreviewMatches(updated);
  };
useEffect(() => {
  axios.get(`${API_BASE}/court/${group}`).then(res => {
    if (res.data.success) {
      setCourts(res.data.courts);
    }
  });
}, [group]);  


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
  const openPreview = (matchData) => {

    // ฟังก์ชันช่วยสร้าง preview ของแต่ละ match
    const buildPreview = ({ p1, p2, p3, p4, court = "" }) => ({
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

    let finalData = [];

    // ⭐ กรณี AUTOMODE ส่งมาหลายแมท
    if (Array.isArray(matchData)) {
      finalData = matchData.map(buildPreview);
    }

    // ⭐ กรณีปกติ (แมทเดียว)
    else {
      finalData = [buildPreview(matchData)];
    }

    // ส่งไป PreviewModal
    setPreviewMatches(finalData);

    setShowPreview(true);      // แสดง modal
    setShowMultiPreview(false); // ปิด modal อื่นถ้ามี
  };
const autoQueueNext = async () => {
  if (!previewMatches || previewMatches.length === 0) return;

  const m = previewMatches[0];

  await axios.post(`${API_BASE}/queue/add`, {
    group,
    p1: m.p1,
    p2: m.p2,
    p3: m.p3,
    p4: m.p4,
    r1: m.r1,
    r2: m.r2,
    r3: m.r3,
    r4: m.r4,
    p1_gender: players.find(p => p.Player_Name === m.p1)?.Player_Gender,
    p2_gender: players.find(p => p.Player_Name === m.p2)?.Player_Gender,
    p3_gender: players.find(p => p.Player_Name === m.p3)?.Player_Gender,
    p4_gender: players.find(p => p.Player_Name === m.p4)?.Player_Gender,
    court: m.court,
    added_by: username
  });

  // ===============================
  // ⭐⭐ ตรงนี้คือของที่ต้องเพิ่ม ⭐⭐
  // ===============================


  alert(`⛔ Court ${m.court} ถูกใช้งานแล้ว`);

  setShowPreview(false);
  setPreviewMatches([]);

  autoQueuedRef.current = false;
};


useEffect(() => {
  // เมื่อ backend update จริง → ล้าง lock

  console.log("♻️ Reset locked courts (backend updated)");
}, [courts]);


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
    if (!data) return;

    const payload = data;

    try {
      await axios.post(`${API_BASE}/match/create`, {
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
      });

      setShowPreview(false);
      setPreviewMatches([]);

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
  const playerOptions = players.map(p => ({
    value: p.Player_Name,
    label: `${p.Player_Name} (${p.Player_Gender})`,
    gender: p.Player_Gender,
  }));

  const colourStyles = {
    option: (styles, { data }) => ({
      ...styles,
      color: data.gender === "ชาย" ? "red" : "blue",
      padding: 8,
    }),
    singleValue: (styles, { data }) => ({
      ...styles,
      color: data.gender === "ชาย" ? "red" : "blue",
    }),
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

  // ⭐ ประวัติคู่แข่งขันเฉพาะ 4 คนที่กำลังจัดแมตช์
  const getPlayerRelation = (playerName, compareList) => {
    const result = {};

    // เตรียมชื่อไว้ก่อน (กัน undefined)
    compareList.forEach(other => {
      if (other && other !== playerName) {
        result[other] = {
          sameTeam: 0,
          opponent: 0
        };
      }
    });

    matches.forEach(m => {
      const team1 = [m.P1, m.P2];
      const team2 = [m.P3, m.P4];

      const allPlayers = [...team1, ...team2];

      // ถ้า playerName ไม่ได้อยู่ในแมตนี้ → ข้าม
      if (!allPlayers.includes(playerName)) return;

      compareList.forEach(other => {
        if (!other || other === playerName) return;

        if (!allPlayers.includes(other)) return;

        const playerInTeam1 = team1.includes(playerName);
        const otherInTeam1 = team1.includes(other);

        if (playerInTeam1 === otherInTeam1) {
          // ทีมเดียวกัน
          result[other].sameTeam++;
        } else {
          // ทีมตรงข้าม
          result[other].opponent++;
        }
      });
    });

    return Object.entries(result).map(([name, record]) => ({
      name,
      sameTeam: record.sameTeam,
      opponent: record.opponent,
      never: record.sameTeam === 0 && record.opponent === 0
    }));
  };
  const updatePlayerFlagInDB = async (playerName, flagName) => {


    try {
      const res = await axios.post(`${API_BASE}/player/update-flag`, {
        group,
        playerName,
        flagName,  // "" ถ้าต้องการล้าง
      });

      if (!res.data.success) {
        console.error("update flag failed:", res.data.error || res.data.message);
      }

    } catch (err) {
      console.error("updatePlayerFlagInDB error:", err);
    }
  };
  // =====================================================
  // BUILD lastEnd (เวลารอนานที่สุดของผู้เล่นแต่ละคน)
  // =====================================================

  const lastEnd = {};

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


  return (
    <div className="match-container">

      {/* HEADER */}
      {/* HEADER */}
      <div className="match-header">
        <div><b>{username}</b></div>
        <div>Group: <b>{group}</b></div>

        <button
          className="btn-back"
          onClick={() =>
            navigate("/player", { state: { username, group } })
          }
        >
          กลับหน้า Player
        </button>

        {/* เปิดแท็บใหม่ + ส่ง group/user */}
        <a
          className="btn-nextqueue"
          href={`/Monitor/${encodeURIComponent(group)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ marginLeft: 10 }}
        >
          เปิดหน้าคิวแมตช์
        </a>
      </div>


      {/* DASHBOARD SUMMARY */}
      <div className="match-summary">

 {/*
        <div className="player-status-wrapper">
          <h4 className="ps-header">จำนวนเกมตามเวลา</h4>

          <div className="rank-scroll-container">
            <div className="rank-grid">
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

                    if (time < playerStats[p].earliest) {
                      playerStats[p].earliest = time;
                    }
                  });
                });

                let sorted = Object.values(playerStats);

                if (sorted.length === 0) {
                  return <div>ยังไม่มีข้อมูลการเล่น</div>;
                }

                // เรียงตามจำนวนเกม (น้อย → มาก)
                sorted = sorted.sort((a, b) => a.count - b.count);

                // หาค่าต่ำสุด สูงสุด สำหรับจัดสี rank
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

                return sorted.map((p, i) => {
                  const classColor = getRankColor(p.count);

                  return (
                    <div key={i} className={`rank-item ${classColor}`}>
                      <span className="rank-name">{p.name}</span>
                      <span className="rank-score">{p.count} เกม</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
*/}


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
      if (p?.Player_Status === "Wait") return "yellow";

      if (p?.Player_Status === "Active" && hasMatch && sec >= 20 * 60)
        return "red";

      return "gray";
    };

    const getStatusText = (name, sec, hasMatch) => {
      const p = players.find((x) => x.Player_Name === name);

      if (p?.Player_Status === "Play") return "Play";

      if (p?.Player_Status === "Wait") {
        if (hasMatch && sec >= 20 * 60) return "เกิน 20 นาที";
        return "Wait";
      }

      if (p?.Player_Status === "Active") {
        if (hasMatch && sec >= 20 * 60) return "เกิน 20 นาที";
        return "Active";
      }

      return "Unknown";
    };

    const filteredPlayers = players.filter(
      (p) =>
        p.Player_Status === "Active" ||
        p.Player_Status === "Wait" ||
        p.Player_Status === "Play"
    );

    const playersWithTime = filteredPlayers.map((pl) => {
      const name = pl.Player_Name;
      const d = lastEnd[name];

      let mmss = { text: "-", sec: 0 };
      let hasMatch = false;

      if (d && Number.isFinite(d.end)) {
        mmss = toMMSS(d.end);
        hasMatch = true;
      }

      return {
        ...pl,
        waitObj: mmss,
        waitSec: mmss.sec,
        hasMatch,
      };
    });

    playersWithTime.sort((a, b) => b.waitSec - a.waitSec);

    return (
      <div className="player-scroll-container">
        <div className="player-grid">
          {playersWithTime.map((pl, idx) => {
            const name = pl.Player_Name;
            const mmss = pl.waitObj;
            const sec = pl.waitSec;
            const hasMatch = pl.hasMatch;

            const color = getColor(name, sec, hasMatch);
            const status = getStatusText(name, sec, hasMatch);

            return (
              <div key={idx} className={`ps-item ${color}`}>
                <span className="ps-name">{name}</span>
                <span className="ps-time">{mmss.text}</span>
                <span className="ps-state">{status}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  })()}
</div>

</div>
      {/* GRID LAYOUT */}
      <div className="match-grid">

        {/* LEFT */}

        {/* RIGHT */}
        <div className="">

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
                      ลบคู่
                    </button>
                  </div>

                </div>
              ))}

              {/* Global Action Buttons */}
          

            </div>
          )}
<div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>
  ⏱ เพิ่มเข้าคิวอัตโนมัติใน {countdown} วินาที
</div>

          {/* ================= SINGLE PREVIEW ================= */}
   {showPreview && previewMatches && previewMatches.length > 0 && (
            <div className="preview-panel-compact">

              <h3>ยืนยัน / แก้ไข Match ทั้งหมด ({previewMatches.length})</h3>

              {previewMatches.map((match, idx) => (
                <div key={idx} className="match-row">

                  {/* HEADER — TITLE + DELETE BUTTON */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10
                  }}>
                    <h4 style={{ marginBottom: 0 }}>Match #{idx + 1}</h4>

                    {/* ⭐ ปุ่มลบแมทนี้ ⭐ */}
                    <button
                      style={{
                        background: "red",
                        color: "white",
                        border: "none",
                        padding: "5px 12px",
                        borderRadius: "5px",
                        cursor: "pointer",
                        fontSize: 14
                      }}
                      onClick={() => {
                        const filtered = previewMatches.filter((_, i) => i !== idx);
                        setPreviewMatches(filtered);
                      }}
                    >
                      ❌ ลบ
                    </button>
                  </div>

                  {/* TEAM 1 */}
                  <div className="team-box">
                    <b>TEAM 1</b>

                    {/* P1 */}
                    <select
                      value={match.p1}
                      onChange={e =>
                        updateMatch(idx, {
                          p1: e.target.value,
                          r1: getPlayerInfo(e.target.value).rank
                        })
                      }
                    >
                      {players.map(p => (
                        <option
                          key={p.Player_Name}
                          value={p.Player_Name}
                          style={{ color: p.Player_Gender === "ชาย" ? "red" : "blue" }}
                        >
                          {p.Player_Name} ({p.Player_Ranking}) {p.Player_Gender}
                        </option>
                      ))}
                    </select>

                    {/* HISTORY P1 */}
                    {match.p1 && (
                      <div className="history-box">
                        <div className="history-title">ประวัติคู่แข่งขัน:</div>

                        {getPlayerRelation(match.p1, [
                          match.p2,
                          match.p3,
                          match.p4
                        ]).map((h, index) => (
                          <div
                            key={index}
                            className={`history-item ${h.never ? "history-none" :
                              h.opponent > 0 ? "history-red" :
                                "history-green"
                              }`}
                          >
                            - {h.name} :{" "}
                            {h.never
                              ? "ยังไม่เคยเจอ"
                              : `ทีมเดียวกัน ${h.sameTeam} ครั้ง • ตรงข้าม ${h.opponent} ครั้ง`}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* P2 */}
                    <select
                      value={match.p2}
                      onChange={e =>
                        updateMatch(idx, {
                          p2: e.target.value,
                          r2: getPlayerInfo(e.target.value).rank
                        })
                      }
                    >
                      {players.map(p => (
                        <option
                          key={p.Player_Name}
                          value={p.Player_Name}
                          style={{ color: p.Player_Gender === "ชาย" ? "red" : "blue" }}
                        >
                          {p.Player_Name} ({p.Player_Ranking}) {p.Player_Gender}
                        </option>
                      ))}
                    </select>

                    {/* HISTORY P2 */}
                    {match.p2 && (
                      <div className="history-box">
                        <div className="history-title">ประวัติคู่แข่งขัน:</div>

                        {getPlayerRelation(match.p2, [
                          match.p1,
                          match.p3,
                          match.p4
                        ]).map((h, index) => (
                          <div
                            key={index}
                            className={`history-item ${h.never ? "history-none" :
                              h.opponent > 0 ? "history-red" :
                                "history-green"
                              }`}
                          >
                            - {h.name} :{" "}
                            {h.never
                              ? "ยังไม่เคยเจอ"
                              : `ทีมเดียวกัน ${h.sameTeam} ครั้ง • ตรงข้าม ${h.opponent} ครั้ง`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* VS */}
                  <div className="vs-text">VS</div>

                  {/* TEAM 2 */}
                  <div className="team-box">
                    <b>TEAM 2</b>

                    {/* P3 */}
                    <select
                      value={match.p3}
                      onChange={e =>
                        updateMatch(idx, {
                          p3: e.target.value,
                          r3: getPlayerInfo(e.target.value).rank
                        })
                      }
                    >
                      {players.map(p => (
                        <option
                          key={p.Player_Name}
                          value={p.Player_Name}
                          style={{ color: p.Player_Gender === "ชาย" ? "red" : "blue" }}
                        >
                          {p.Player_Name} ({p.Player_Ranking}) {p.Player_Gender}
                        </option>
                      ))}
                    </select>

                    {/* HISTORY P3 */}
                    {match.p3 && (
                      <div className="history-box">
                        <div className="history-title">ประวัติคู่แข่งขัน:</div>

                        {getPlayerRelation(match.p3, [
                          match.p1,
                          match.p2,
                          match.p4
                        ]).map((h, index) => (
                          <div
                            key={index}
                            className={`history-item ${h.never ? "history-none" :
                              h.opponent > 0 ? "history-red" :
                                "history-green"
                              }`}
                          >
                            - {h.name} :{" "}
                            {h.never
                              ? "ยังไม่เคยเจอ"
                              : `ทีมเดียวกัน ${h.sameTeam} ครั้ง • ตรงข้าม ${h.opponent} ครั้ง`}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* P4 */}
                    <select
                      value={match.p4}
                      onChange={e =>
                        updateMatch(idx, {
                          p4: e.target.value,
                          r4: getPlayerInfo(e.target.value).rank
                        })
                      }
                    >
                      {players.map(p => (
                        <option
                          key={p.Player_Name}
                          value={p.Player_Name}
                          style={{ color: p.Player_Gender === "ชาย" ? "red" : "blue" }}
                        >
                          {p.Player_Name} ({p.Player_Ranking}) {p.Player_Gender}
                        </option>
                      ))}
                    </select>

                    {/* HISTORY P4 */}
                    {match.p4 && (
                      <div className="history-box">
                        <div className="history-title">ประวัติคู่แข่งขัน:</div>

                        {getPlayerRelation(match.p4, [
                          match.p1,
                          match.p2,
                          match.p3
                        ]).map((h, index) => (
                          <div
                            key={index}
                            className={`history-item ${h.never ? "history-none" :
                              h.opponent > 0 ? "history-red" :
                                "history-green"
                              }`}
                          >
                            - {h.name} :{" "}
                            {h.never
                              ? "ยังไม่เคยเจอ"
                              : `ทีมเดียวกัน ${h.sameTeam} ครั้ง • ตรงข้าม ${h.opponent} ครั้ง`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* COURT */}
                  <div className="court-box">
                    <b>Court</b>
                    <select
                      value={match.court}
                      onChange={e =>
                        updateMatch(idx, { court: e.target.value })
                      }
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(c => (
                        <option key={c} value={c}>Court {c}</option>
                      ))}
                    </select>
                  </div>

                </div>
              ))}




              {/* BUTTONS */}
              <div className="action-buttons">

                {/* START */}
                <button
                  className="btn green"
                  onClick={() => {
                    confirmCreateMatch(previewMatches[0]);   // ⭐ ใช้ match แรก
                    setPreviewMatch(null);
                    setShowPreview(false);
                  }}
                >
                  ? Start
                </button>

     <button
  className="btn blue"
  onClick={() => {
    autoQueuedRef.current = true; // กัน auto ซ้ำ
    autoQueueNext();
  }}
>
  ➕ คิวถัดไป
</button>



                {/* CANCEL */}
                <button
                  className="btn red"
                  onClick={() => {
                    setShowPreview(false);
                    setPreviewMatch(null);
                  }}
                >
                  ? ยกเลิก
                </button>

              </div>

            </div>
          )}




          {/* RANDOM PANEL */}
          <RandomPanel
            players={players}
            courts={courts}   // ⭐⭐ สำคัญมาก

            matchCount={matchCount}
            group={group}
            lastEnd={lastEnd}   // ⭐ ส่งเวลารอ
            now={now}           // ⭐ ส่งเวลาปัจจุบัน                     // ? ส่ง group ให้ RandomPanel
            openPreview={openPreview}
            openPreviewMulti={openPreviewMulti}
            updatePlayerFlagInDB={updatePlayerFlagInDB}   // ? ฟังก์ชันอัปเดต Flag_Player DB
              showPreview={showPreview}
  setShowPreview={setShowPreview}
  previewMatches={previewMatches}
  setPreviewMatches={setPreviewMatches}
          />

          {/* ============================= PREVIEW PANEL ============================= */}
       
          {/* ============================= NEXT QUEUE LIST ============================= */}
          {queueList.length > 0 && (
            <div className="next-match-box">

              <h3>คิวแมตช์ถัดไป ({queueList.length}/10)</h3>

              {queueList.map((q) => (
                <div key={q.id} className="next-match-item">

                  <div className="next-match-info">

                    {/* TEAM 1 */}
                    {/* TEAM 1 */}
                    <div className="team">

                      {/* P1 Autocomplete */}
                      <Select
                        className="edit-select"
                        styles={colourStyles}
                        options={playerOptions}
                        placeholder="เลือกผู้เล่น..."
                        value={playerOptions.find(o => o.value === q.P1) || null}
                        onChange={(opt) => updateQueueField(q.id, "P1", opt?.value || "")}
                        isSearchable
                      />

                      {/* P2 Autocomplete */}
                      <Select
                        className="edit-select"
                        styles={colourStyles}
                        options={playerOptions}
                        placeholder="เลือกผู้เล่น..."
                        value={playerOptions.find(o => o.value === q.P2) || null}
                        onChange={(opt) => updateQueueField(q.id, "P2", opt?.value || "")}
                        isSearchable
                      />
                    </div>

                    {/* VS */}
                    <div className="vs">vs</div>

                    {/* TEAM 2 */}
                    <div className="team">

                      {/* P3 Autocomplete */}
                      <Select
                        className="edit-select"
                        styles={colourStyles}
                        options={playerOptions}
                        placeholder="เลือกผู้เล่น..."
                        value={playerOptions.find(o => o.value === q.P3) || null}
                        onChange={(opt) => updateQueueField(q.id, "P3", opt?.value || "")}
                        isSearchable
                      />

                      {/* P4 Autocomplete */}
                      <Select
                        className="edit-select"
                        styles={colourStyles}
                        options={playerOptions}
                        placeholder="เลือกผู้เล่น..."
                        value={playerOptions.find(o => o.value === q.P4) || null}
                        onChange={(opt) => updateQueueField(q.id, "P4", opt?.value || "")}
                        isSearchable
                      />
                    </div>


                    {/* COURT */}
                    <div className="court-info">
                      <select
                        value={q.Court || ""}
                        onChange={e => updateQueueField(q.id, "Court", e.target.value)}
                      >
                        <option value="">เลือกคอร์ท</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(c => (
                          <option key={c} value={c}>Court {c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ACTIONS */}
                  <div className="queue-actions">

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

                        await axios.post(`${API_BASE}/queue/remove`, { id: q.id });
                      }}
                    >
                      Start
                    </button>

                    <button
                      className="btn-delete"
                      onClick={async () => {
                        if (!window.confirm("ต้องการลบคิวนี้หรือไม่?")) return;
                        await axios.post(`${API_BASE}/queue/remove`, { id: q.id });
                      }}
                    >
                      ? ลบ
                    </button>

                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ============================= MANUAL PANEL ============================= */}
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
