// ==========================
// RandomPanel.js  (PART 1/4)
// ==========================
import axios from "axios";

import React, { useState, useEffect, useRef } from "react";
import socket from "./socket";

import Select from "react-select";
import { API_BASE } from "./config";   // <<< ใช้แบบนี้
/* ============================================================
   CONFIG — Rank Score + Rank Rules
============================================================ */
const RANK_SCORES = {
  Baby: 1,
  BG: 3,
  NB: 5,
  N: 10,
  S: 15,
};

const ALLOWED_BASE = {
  Baby: ["Baby", "BG"],
  BG: ["BG", "Baby"],
  NB: ["NB", "N"],
  N: ["NB", "S", "N"],
  S: ["N", "S", "NB"],
};

/* ============================================================
   MAIN COMPONENT
============================================================ */
const RandomPanel = ({
  players = [],
  courts = [],              // ⭐⭐ เพิ่ม
  matchCount = {},
  partnerHistory = {},
  opponentHistory = {},
  openPreview,
  lastEnd,
  now,
  onUpdatePlayers,
  updatePlayerFlagInDB,   // ต้องส่งมาจาก Match.js
  showPreview,
  setCourts,          // ✅ เพิ่ม
  group,              // ✅ เพิ่ม
  previewMatches,

}) => {

  /* ============================================================
     STATE
  ============================================================ */
  const [mode, setMode] = useState("mode4");
  const lockedCourtsRef = useRef(new Set());
  const [selectedP1, setSelectedP1] = useState("");
  const [selectedP2, setSelectedP2] = useState("");
  const [autoLoopOn, setAutoLoopOn] = useState(false);
  const [lastTriggerHash, setLastTriggerHash] = useState("");


  const [court, setCourt] = useState(1);
  const [genderMode, setGenderMode] = useState("");
  const [selectedFixedPair, setSelectedFixedPair] = useState("");
  const [autoRunOnce, setAutoRunOnce] = useState(false);
  const [matchQueue, setMatchQueue] = useState([]);   // ← เก็บแมทถัดไปสูงสุด 5 แมท
  const autoRunningRef = React.useRef(false);
  const autoPreviewLock = React.useRef(false);

  const [fixedPairs, setFixedPairs] = useState([]);  // << โหลดจาก DB
  const [fixedA, setFixedA] = useState("");
  const [fixedB, setFixedB] = useState("");

  const [localPlayers, setLocalPlayers] = useState(players);

  useEffect(() => {
    setLocalPlayers(players);
  }, [players]);

  /* ============================================================
     FILTER / OPTIONS
  ============================================================ */
  const filterByGenderMode = (list) => {
    if (!Array.isArray(list)) return [];
    return list.filter((p) => {
      if (!p.Player_Gender) return true;
      if (genderMode === "m2m") return p.Player_Gender === "ชาย";
      if (genderMode === "f2f") return p.Player_Gender === "หญิง";
      if (genderMode === "mix") return true;
      return true;
    });
  };

  const activePlayers = filterByGenderMode(
    players.filter((p) => p.Player_Status === "Active")
  );
  // ⭐⭐ ACTIVE COURTS (ใช้สำหรับ Auto Mode)

  const activeCourts = courts.filter(
    (c) => c.Cort_Status === "Active"
  );




  useEffect(() => {
    const onRefresh = () => {
      console.log("🔄 refresh from socket");
      fetchCourts();
    };

    socket.on("refresh", onRefresh);   // ✅ ถูก
    return () => {
      socket.off("refresh", onRefresh);
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
  const runAutoByActiveCourts = () => {

    if (activePlayers.length < 4) {
      console.log("❌ ผู้เล่นไม่พอ");
      return null;
    }

    const usedPlayers = new Set();
    const usedCourts = new Set();
    const matches = [];

    while (true) {

      // 🔁 เช็ค court ใหม่ทุก loop (หัวใจ)
      const freeCourts = getActiveCourtsRealtime()
        .filter(c => !usedCourts.has(c));

      if (freeCourts.length === 0) {
        console.log("⛔ ไม่มี Court ว่างแล้ว → break");
        break;
      }

      if (activePlayers.length - usedPlayers.size < 4) {
        console.log("⛔ ผู้เล่นไม่พอ → break");
        break;
      }

      const match = runAutoMode();
      if (!match) {
        console.log("⛔ สุ่ม match ไม่ได้ → break");
        break;
      }


/**
 * ⭐ Auto priority sort
 * 1) รอเกิน 20 นาที ก่อน
 * 2) เล่นน้อยที่สุดก่อน
 * 3) ถ้าเท่ากัน ใช้เวลารอมากกว่า
 */


      const ps = [match.p1, match.p2, match.p3, match.p4];

      // ❌ กันผู้เล่นซ้ำ
      if (ps.some(p => usedPlayers.has(p))) {
        console.log("⚠️ ผู้เล่นซ้ำ → break");
        break;
      }
      const court = freeCourts[0];
      lockedCourtsRef.current.add(court);   // 🔒 LOCK COURT ทันที

      match.court = court;
      matches.push(match);

      console.log(`🏸 Assign Match → Court ${court} (LOCKED)`);


      // 🔥 เช็คสถานะ court ซ้ำอีกครั้ง (กัน race condition)
      const courtObj = courts.find(c => c.Cort === court);
      if (!courtObj || courtObj.Cort_Status !== "Active") {
        console.log(`⛔ Court ${court} ไม่ Active แล้ว → break`);
        break;
      }

      // ✅ mark used
      ps.forEach(p => usedPlayers.add(p));
      usedCourts.add(court);

      match.court = court;
      matches.push(match);

      console.log(`🏸 Assign Match → Court ${court}`);
    }

    return matches.length > 0 ? matches : null;
  };

  useEffect(() => {
    // เมื่อ backend update จริง → ล้าง lock
    lockedCourtsRef.current.clear();
    console.log("♻️ Reset locked courts (backend updated)");
  }, [courts]);

  useEffect(() => {
    if (!showPreview) {
      autoPreviewLock.current = false; // 🔓 ปลด lock
    }
  }, [showPreview]);


  const playerOptions = activePlayers.map((p) => ({
    value: p.Player_Name,
    label: `${p.Player_Name} (${p.Player_Ranking}) — ${matchCount?.[p.Player_Name] || 0} Match — ${p.Player_Gender}`,
    gender: p.Player_Gender,
  }));


  const simpleOptions = activePlayers.map((p) => ({
    value: p.Player_Name,
    label: p.Player_Name,
    gender: p.Player_Gender,
  }));

  const colourStyles = {
    option: (styles, { data }) => ({
      ...styles,
      color: data.gender === "ชาย" ? "red" : "blue",
      padding: 10,
    }),
    singleValue: (styles, { data }) => ({
      ...styles,
      color: data?.gender === "ชาย" ? "red" : "blue",
    }),
  };
  const runAutoByCourts = () => {
    if (activeCourts.length === 0) return;
    if (activePlayers.length < 4) return;

    let usedPlayers = new Set();
    let created = 0;

    for (let i = 0; i < activeCourts.length; i++) {
      // เหลือคนไม่พอ
      if (activePlayers.length - usedPlayers.size < 4) break;

      // สร้าง match ด้วย logic เดิมของคุณ
      const match = runAutoMode();
      if (!match) break;

      // ผูกคอร์ท
      match.court = activeCourts[i].Cort;

      // กันผู้เล่นซ้ำ
      [match.p1, match.p2, match.p3, match.p4].forEach(p =>
        usedPlayers.add(p)
      );

      addMatchToQueue(match);
      created++;
    }

    console.log(`🏸 AutoMode: สร้าง ${created} match ตามคอร์ท Active`);
  };





  /* ============================================================
     ใช้คู่ล๊อคจาก Database (Flag_Player)
     → โหลดทุกครั้งที่ players เปลี่ยน
  ============================================================ */
  useEffect(() => {
    if (!players || players.length === 0) return;

    const autoPairs = [];

    players.forEach(p => {
      if (p.Flag_Player) {
        const pair = [p.Player_Name, p.Flag_Player].sort();
        const key = pair.join("-");

        if (!autoPairs.some(x => x.join("-") === key)) {
          autoPairs.push(pair);
        }
      }
    });

    setFixedPairs(autoPairs);
  }, [players]);


// ============================
// HARD CONSTRAINT (เด็ดขาด)
// ============================
const violatesHardLimit = (p1, p2, p3, p4) => {

  // partner
  if ((partnerHistory?.[p1]?.[p2] || 0) >= 2) return true;
  if ((partnerHistory?.[p3]?.[p4] || 0) >= 2) return true;

  // opponent
  const opp = [
    [p1, p3], [p1, p4],
    [p2, p3], [p2, p4],
  ];

  for (const [a, b] of opp) {
    if ((opponentHistory?.[a]?.[b] || 0) >= 2) return true;
  }

  return false;
};




  /* ============================================================
     ฟังก์ชันอ่าน Flag คู่ล๊อคจาก players
  ============================================================ */
  const getFlagPartnerFromPlayers = (name) => {
    if (!name) return null;
    const p = players.find((x) => x.Player_Name === name);
    if (!p) return null;

    if (!p.Flag_Player || p.Flag_Player.trim() === "") return null;

    return p.Flag_Player.trim();
  };
  const isCrossLocked = (a, b) => {
    const pA = getFlagPartnerFromPlayers(a);
    const pB = getFlagPartnerFromPlayers(b);
    return pA === b && pB === a;
  };

  /* ============================================================
     Auto-fill P2 เมื่อ P1 มีคู่ล๊อค (Flag_Player)
  ============================================================ */
  useEffect(() => {
    if (!selectedP1) return;

    const flagPartner = getPairForPlayer(selectedP1);
    if (flagPartner) {
      setSelectedP2(flagPartner);  // << auto-set
    }
  }, [selectedP1, players]);



  /* updatePlayers helper to inform parent or fallback to local state */
  /* ============================================================
    UPDATE PLAYERS helper (เชื่อมกับ Match.js)
 ============================================================ */
  const updatePlayers = (updater) => {
    if (typeof onUpdatePlayers === "function") {
      try {
        if (typeof updater === "function") {
          onUpdatePlayers((prev) => updater(prev));
        } else {
          onUpdatePlayers(updater);
        }
      } catch (err) {
        setLocalPlayers((prev) => (typeof updater === "function" ? updater(prev) : updater));
      }
    } else {
      setLocalPlayers((prev) => (typeof updater === "function" ? updater(prev) : updater));
    }
  };

  /* ============================================================
     FIXED PAIRS — ADD
  ============================================================ */
  const addFixedPair = async () => {
    if (!fixedA || !fixedB) return alert("กรุณาเลือกทั้งสองคน");
    if (fixedA === fixedB) return alert("เลือกคนซ้ำไม่ได้");

    // ห้ามซ้ำ
    const exists = fixedPairs.some((p) => p.includes(fixedA) || p.includes(fixedB));
    if (exists) return alert("คนนี้ถูกล๊อคอยู่แล้ว");

    const newPair = [fixedA, fixedB].sort();

    setFixedPairs((prev) => [...prev, newPair]);

    updatePlayers((prev = []) =>
      prev.map((p) =>
        p.Player_Name === fixedA
          ? { ...p, Flag_Player: fixedB }
          : p.Player_Name === fixedB
            ? { ...p, Flag_Player: fixedA }
            : p
      )
    );

    try {
      if (typeof updatePlayerFlagInDB === "function") {
        await updatePlayerFlagInDB(fixedA, fixedB);
        await updatePlayerFlagInDB(fixedB, fixedA);
      }
    } catch (err) {
      console.error("addFixedPair update DB error:", err);
    }

    setFixedA("");
    setFixedB("");
  };

  /* ============================================================
     FIXED PAIRS — REMOVE
  ============================================================ */
  const removeFixedPair = async (pair) => {
    const [a, b] = pair;
    setFixedPairs((prev) => prev.filter((p) => p.join("-") !== pair.join("-")));

    updatePlayers((prev = []) =>
      prev.map((p) =>
        p.Player_Name === a || p.Player_Name === b
          ? { ...p, Flag_Player: "" }
          : p
      )
    );

    try {
      if (typeof updatePlayerFlagInDB === "function") {
        await updatePlayerFlagInDB(a, "");
        await updatePlayerFlagInDB(b, "");
      }
    } catch (err) {
      console.error("removeFixedPair update DB error:", err);
    }
  };

  /* ============================================================
     COMMON HELPERS
  ============================================================ */
  const getScore = (rank) => RANK_SCORES[rank] || 0;

  const allowedPartnerRanks = (rank) => {
    const base = ALLOWED_BASE[rank] ? [...ALLOWED_BASE[rank]] : [];
    if (!base.includes(rank)) base.push(rank);
    return base;
  };

  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const hasPartnerBefore = (a, b) => (partnerHistory?.[a]?.[b] || 0) > 0;
  const hasOpponentBefore = (a, b) => (opponentHistory?.[a]?.[b] || 0) > 0;

  const isFixed = (name) => fixedPairs.some((pair) => pair.includes(name));

  /* ============================================================
     CREATE MATCH RESULT OBJECT
  ============================================================ */
  const buildResult = (
    p1,
    p2,
    p3,
    p4,
    partnerRepeats = [],
    opponentRepeats = [],
    explanation = ""
) => {

  // 🚫 HARD BLOCK
  if (violatesHardLimit(
    p1.Player_Name,
    p2.Player_Name,
    p3.Player_Name,
    p4.Player_Name
  )) {
    return null;
  }
    const highlight = {};
    [p1, p2, p3, p4].forEach((pl) => {
      highlight[pl.Player_Name] = {
        partnerRepeat: false,
        opponentRepeat: false
      };
    });

    partnerRepeats.forEach((pair) => {
      const [a, b] = pair.split("-");
      if (highlight[a]) highlight[a].partnerRepeat = true;
      if (highlight[b]) highlight[b].partnerRepeat = true;
    });

    opponentRepeats.forEach((pair) => {
      const [a, b] = pair.split("-");
      if (highlight[a]) highlight[a].opponentRepeat = true;
      if (highlight[b]) highlight[b].opponentRepeat = true;
    });

    return {
      p1: p1.Player_Name,
      p2: p2.Player_Name,
      p3: p3.Player_Name,
      p4: p4.Player_Name,
      court,
      highlightPlayers: highlight,
      flags: { partnerRepeats, opponentRepeats },
      explanation          // ⭐ เพิ่มออกมาที่นี่
    };
  };



  /* ============================================================
    FIND MATCH — MODE 1 (เลือก P1  หา P2,P3,P4)
 ============================================================ */
  const findMatchForP1 = (p1Name) => {
    const P1 = activePlayers.find((p) => p.Player_Name === p1Name);
    if (!P1) return null;

    const forcedP2 = getPairForPlayer(p1Name); // คู่ล๊อคของ P1

    const allowedRanksForP2 = allowedPartnerRanks(P1.Player_Ranking);

    let candidates = activePlayers.filter(
      (p) =>
        p.Player_Name !== p1Name &&
        allowedRanksForP2.includes(p.Player_Ranking)
    );

    // ถ้ามีคู่ล๊อค P1 → บังคับใช้
    if (forcedP2) {
      const forced = candidates.find((p) => p.Player_Name === forcedP2);
      if (!forced) return alert(`คู่ล๊อค ${forcedP2} ไม่ผ่านกฎ Rank`);
      candidates = [forced];
    }

    candidates = shuffle(candidates);

    let best = null;
    let bestRepeat = Infinity;

    for (const P2 of candidates) {

      // ⭐⭐⭐ NEW: บังคับให้ P2 ต้องล๊อคกับ P1 ด้วย (bi-directional lock)
      if (!enforcePairForP2(P1.Player_Name, P2.Player_Name)) continue;

      const targetScore =
        getScore(P1.Player_Ranking) + getScore(P2.Player_Ranking);

      const pool = shuffle(
        activePlayers.filter(
          (p) => p.Player_Name !== P1.Player_Name && p.Player_Name !== P2.Player_Name
        )
      );

      for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
          const p3 = pool[i];
          const p4 = pool[j];

          // ⭐ TEAM2 ต้องล๊อคคู่ถูกต้อง
          if (!enforcePairForOpposite(p3.Player_Name, p4.Player_Name)) continue;

          const okOpp =
            allowedPartnerRanks(p3.Player_Ranking).includes(p4.Player_Ranking) ||
            allowedPartnerRanks(p4.Player_Ranking).includes(p3.Player_Ranking);
          if (!okOpp) continue;

          if (
            getScore(p3.Player_Ranking) + getScore(p4.Player_Ranking) !==
            targetScore
          ) continue;

          const partnerRepeats = [];
          const opponentRepeats = [];

          if (hasPartnerBefore(P1.Player_Name, P2.Player_Name))
            partnerRepeats.push(`${P1.Player_Name}-${P2.Player_Name}`);
          if (hasPartnerBefore(p3.Player_Name, p4.Player_Name))
            partnerRepeats.push(`${p3.Player_Name}-${p4.Player_Name}`);

          [[P1, p3], [P1, p4], [P2, p3], [P2, p4]].forEach(([A, B]) => {
            if (hasOpponentBefore(A.Player_Name, B.Player_Name))
              opponentRepeats.push(`${A.Player_Name}-${B.Player_Name}`);
          });

          const repeatCount =
            partnerRepeats.length + opponentRepeats.length;

          if (repeatCount === 0)
            return buildResult(P1, P2, p3, p4, partnerRepeats, opponentRepeats);

          if (repeatCount < bestRepeat) {
            bestRepeat = repeatCount;
            best = buildResult(P1, P2, p3, p4, partnerRepeats, opponentRepeats);
          }
        }
      }
    }

    return best;
  };


  /* ============================================================
     FIND MATCH — MODE 2 (เลือก P1,P2  สุ่มหา P3,P4)
  ============================================================ */
  const findMatchForP1P2 = (p1Name, p2Name) => {
    const P1 = activePlayers.find((p) => p.Player_Name === p1Name);
    const P2 = activePlayers.find((p) => p.Player_Name === p2Name);

    if (!P1 || !P2) return null;

    // ⭐⭐⭐ NEW: P2 ต้องล๊อคกับ P1 ถ้ามีคู่ล๊อค
    if (!enforcePairForP2(p1Name, p2Name)) return null;

    const targetScore =
      getScore(P1.Player_Ranking) + getScore(P2.Player_Ranking);

    const pool = shuffle(
      activePlayers.filter(
        (p) => p.Player_Name !== p1Name && p.Player_Name !== p2Name
      )
    );

    let best = null;
    let bestRepeat = Infinity;

    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const p3 = pool[i];
        const p4 = pool[j];

        // ⭐ TEAM2 ต้องล๊อคตามคู่ล๊อคใน DB
        if (!enforcePairForOpposite(p3.Player_Name, p4.Player_Name)) continue;

        const okOpp =
          allowedPartnerRanks(p3.Player_Ranking).includes(p4.Player_Ranking) ||
          allowedPartnerRanks(p4.Player_Ranking).includes(p3.Player_Ranking);
        if (!okOpp) continue;

        if (
          getScore(p3.Player_Ranking) + getScore(p4.Player_Ranking) !==
          targetScore
        ) continue;

        const partnerRepeats = [];
        const opponentRepeats = [];

        if (hasPartnerBefore(p1Name, p2Name))
          partnerRepeats.push(`${p1Name}-${p2Name}`);
        if (hasPartnerBefore(p3.Player_Name, p4.Player_Name))
          partnerRepeats.push(`${p3.Player_Name}-${p4.Player_Name}`);

        [[P1, p3], [P1, p4], [P2, p3], [P2, p4]].forEach(([A, B]) => {
          if (hasOpponentBefore(A.Player_Name, B.Player_Name))
            opponentRepeats.push(`${A.Player_Name}-${B.Player_Name}`);
        });

        const repeatScore =
          partnerRepeats.length + opponentRepeats.length;

        if (repeatScore === 0)
          return buildResult(P1, P2, p3, p4, partnerRepeats, opponentRepeats);

        if (repeatScore < bestRepeat) {
          bestRepeat = repeatScore;
          best = buildResult(P1, P2, p3, p4, partnerRepeats, opponentRepeats);
        }
      }
    }

    return best;
  };


  /* ============================================================
     FIND MATCH — MODE 3 (ใช้ "คู่ล๊อคจาก DB"  หา P3,P4)
  ============================================================ */
  const findMatchForFixedPair = (p1Name, p2Name) => {
    return findMatchForP1P2(p1Name, p2Name); // ใช้ logic mode2 แต่บังคับ p1/p2 จาก DB
  };
  // ตรวจว่าคู่ล๊อคของ P2 ต้องเป็น P1 เท่านั้น
  const enforcePairForP2 = (p1Name, p2Name) => {
    const lockedP2 = getPairForPlayer(p2Name); // ดึงคู่ล๊อคของ P2 จาก DB เช่น Flag_Player

    if (!lockedP2) return true;          // ถ้า P2 ไม่มีคู่ล๊อค → ผ่าน
    return lockedP2 === p1Name;          // ถ้ามีคู่ล๊อค → ต้องเป็น p1 เท่านั้น
  };

  /* ============================================================
     FIND MATCH — MODE 4 (เลือก P1  หา 3 คน Rank ใกล้ที่สุด)
  ============================================================ */
  const findClosestPlayers = (p1Name) => {
    const P1 = activePlayers.find((p) => p.Player_Name === p1Name);
    if (!P1) return null;

    const others = activePlayers
      .filter((p) => p.Player_Name !== p1Name)
      .map((p) => ({
        player: p,
        diff: Math.abs(getScore(P1.Player_Ranking) - getScore(p.Player_Ranking)),
      }))
      .sort((a, b) => a.diff - b.diff);

    if (others.length < 3) return null;

    const top = others.slice(0, 8);
    const combos = [];

    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        for (let k = j + 1; k < top.length; k++) {
          combos.push([top[i].player, top[j].player, top[k].player]);
        }
      }
    }

    let best = null;
    let bestScoreDiff = Infinity;
    let bestRepeatScore = Infinity;

    for (const combo of shuffle(combos)) {
      const [a, b, c] = combo;

      for (const partner of [a, b, c]) {

        // -----------------------------
        // ⭐ NEW: P2 ต้องล๊อคหาคู่ล๊อคตรงกันด้วย
        // -----------------------------
        if (!enforcePairForP2(P1.Player_Name, partner.Player_Name)) continue;

        const opp = [a, b, c].filter(
          (x) => x.Player_Name !== partner.Player_Name
        );

        const p3 = opp[0];
        const p4 = opp[1];

        // -----------------------------
        // ⭐ TEAM2 ต้องเป็นคู่ล๊อคที่ถูกต้อง
        // -----------------------------
        if (!enforcePairForOpposite(p3.Player_Name, p4.Player_Name)) continue;

        const partnerOk =
          allowedPartnerRanks(P1.Player_Ranking).includes(
            partner.Player_Ranking
          );

        const oppOk =
          allowedPartnerRanks(p3.Player_Ranking).includes(
            p4.Player_Ranking
          );

        if (!partnerOk || !oppOk) continue;

        const scoreA =
          getScore(P1.Player_Ranking) + getScore(partner.Player_Ranking);
        const scoreB =
          getScore(p3.Player_Ranking) + getScore(p4.Player_Ranking);
        const scoreDiff = Math.abs(scoreA - scoreB);

        const partnerRepeats = [];
        const opponentRepeats = [];

        if (hasPartnerBefore(P1.Player_Name, partner.Player_Name))
          partnerRepeats.push(`${P1.Player_Name}-${partner.Player_Name}`);

        if (hasPartnerBefore(p3.Player_Name, p4.Player_Name))
          partnerRepeats.push(`${p3.Player_Name}-${p4.Player_Name}`);

        [[P1, p3], [P1, p4], [partner, p3], [partner, p4]].forEach(
          ([A, B]) => {
            if (hasOpponentBefore(A.Player_Name, B.Player_Name))
              opponentRepeats.push(`${A.Player_Name}-${B.Player_Name}`);
          }
        );

        const repeatScore =
          partnerRepeats.length + opponentRepeats.length;

        if (
          scoreDiff < bestScoreDiff ||
          (scoreDiff === bestScoreDiff && repeatScore < bestRepeatScore)
        ) {
          best = { partner, opp: [p3, p4], partnerRepeats, opponentRepeats };
          bestScoreDiff = scoreDiff;
          bestRepeatScore = repeatScore;
        }
      }
    }

    if (!best) return null;

    return buildResult(
      P1,
      best.partner,
      best.opp[0],
      best.opp[1],
      best.partnerRepeats,
      best.opponentRepeats
    );
  };

  /* ============================================================
     STRICT RULE FUNCTIONS (rank gap ≤ 1, partner ≤ 1, opponent ≤ 2)
  ============================================================ */
  const getRankScore = (name) => {
    const p = activePlayers.find(x => x.Player_Name === name);
    if (!p) return 0;
    return RANK_SCORES[p.Player_Ranking] || 0;
  };

const handicapOK = (a, b) => {
  const ra = getRankScore(a);
  const rb = getRankScore(b);
  const gap = Math.abs(ra - rb);

  // อนุญาต gap สูงสุด 2
  if (gap <= 2) return true;

  // ถ้าเคยเจอกันมาแล้ว → ไม่อนุญาต
  if ((opponentHistory?.[a]?.[b] || 0) > 0) return false;

  return false;
};

const partnerTooMany = (a, b) =>
  (partnerHistory?.[a]?.[b] || 0) >= 2;


  const opponentTooMany = (a, b) =>
    (opponentHistory?.[a]?.[b] || 0) >= 2;

  const isStrictValidMatch = (m) => {
    if (!m) return false;

    const { p1, p2, p3, p4 } = m;

    if (!handicapOK(p1, p2)) return false;
    if (!handicapOK(p3, p4)) return false;
    if (!handicapOK(p1, p3)) return false;
    if (!handicapOK(p2, p4)) return false;

    if (partnerTooMany(p1, p2)) return false;
    if (partnerTooMany(p3, p4)) return false;

    const oppPairs = [
      [p1, p3], [p1, p4],
      [p2, p3], [p2, p4],
    ];

    for (const [A, B] of oppPairs) {
      if (opponentTooMany(A, B)) return false;
    }

    return true;
  };

  /* ============================================================
     MATCH SCORE SYSTEM
  ============================================================ */
  const getMatchScore = (m) => {
    const { p1, p2, p3, p4 } = m;
    let score = 1000;

    const partnerPairs = [[p1, p2], [p3, p4]];
    partnerPairs.forEach(([A, B]) => {
      score -= (partnerHistory?.[A]?.[B] || 0) * 300;
    });

    const oppPairs = [
      [p1, p3], [p1, p4],
      [p2, p3], [p2, p4],
    ];
    oppPairs.forEach(([A, B]) => {
      score -= (opponentHistory?.[A]?.[B] || 0) * 100;
    });

    const H = handicapOK;
    if (H(p1, p2)) score += 40;
    if (H(p3, p4)) score += 40;
    if (H(p1, p3)) score += 20;
    if (H(p2, p4)) score += 20;

    return score;
  };

  /* ============================================================
     PICK BEST MATCH
  ============================================================ */
const pickBestMatch = (list) => {
  if (!list || list.length === 0) return null;

  let best = null, bestScore = -Infinity;

  list
    .filter(Boolean) // 🚫 ตัด null
    .forEach(m => {
      const { p1, p2, p3, p4 } = m;

      // 🚫 HARD BLOCK ซ้ำอีกชั้น
      if (violatesHardLimit(p1, p2, p3, p4)) return;

      const s = getMatchScore(m);
      if (s > bestScore) {
        bestScore = s;
        best = m;
      }
    });

  return best;
};

  /* ============================================================
     FORCED MATCH — ใช้เมื่อ strict/fallback ใช้ไม่ได้
  ============================================================ */
  const findForcedMatch = (p1Name) => {
    const P1 = activePlayers.find(p => p.Player_Name === p1Name);
    if (!P1) return null;

    const others = activePlayers.filter(p => p.Player_Name !== p1Name);
    if (others.length < 3) return null;

    let best = null, bestScore = -Infinity;

    for (let i = 0; i < others.length; i++) {
      for (let j = i + 1; j < others.length; j++) {
        for (let k = j + 1; k < others.length; k++) {
          const arr = [others[i], others[j], others[k]];

          for (let partner of arr) {
            const opp = arr.filter(x => x !== partner);
            const match = buildResult(P1, partner, opp[0], opp[1]);
if (!match) continue; // 🚫 hard block


            let sc = getMatchScore(match);
            sc -= 1000; // forced penalty

            if (sc > bestScore) {
              bestScore = sc;
              best = match;
            }
          }
        }
      }
    }
    return best;
  };

  /* ============================================================
     FALLBACK RANK MATCH — gap ≤ 2
  ============================================================ */
  const findFallbackRankMatch = (p1Name) => {
    const P1 = activePlayers.find(p => p.Player_Name === p1Name);
    if (!P1) return null;

    const p1Score = getRankScore(p1Name);

    const sorted = activePlayers
      .filter(p => p.Player_Name !== p1Name)
      .map(p => ({
        player: p,
        diff: Math.abs(getRankScore(p.Player_Name) - p1Score)
      }))
      .sort((a, b) => a.diff - b.diff);

    if (sorted.length < 3) return null;

    let best = null, bestScore = -Infinity;

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        for (let k = j + 1; k < sorted.length; k++) {

          const arr = [sorted[i].player, sorted[j].player, sorted[k].player];

          for (let P2 of arr) {
            const opp = arr.filter(x => x !== P2);

            // fallback handicap → gap ≤ 2
            const ok = (A, B) =>
              Math.abs(getRankScore(A) - getRankScore(B)) <= 2;

            if (!ok(P1.Player_Name, P2.Player_Name)) continue;
            if (!ok(opp[0].Player_Name, opp[1].Player_Name)) continue;

            if (partnerTooMany(P1.Player_Name, P2.Player_Name)) continue;
            if (partnerTooMany(opp[0].Player_Name, opp[1].Player_Name)) continue;

            if (
              opponentTooMany(P1.Player_Name, opp[0].Player_Name) ||
              opponentTooMany(P1.Player_Name, opp[1].Player_Name) ||
              opponentTooMany(P2.Player_Name, opp[0].Player_Name) ||
              opponentTooMany(P2.Player_Name, opp[1].Player_Name)
            ) continue;

            const match = buildResult(P1, P2, opp[0], opp[1]);
            const score = getMatchScore(match);

            if (score > bestScore) {
              bestScore = score;
              best = match;
            }
          }
        }
      }
    }

    return best;
  };

  /* ============================================================
     EXPLANATION BUILDER
  ============================================================ */
  const buildExplanation = (title, details = []) => {
    let txt = `📌 ${title}\n`;
    details.forEach(d => (txt += `• ${d}\n`));
    return txt.trim();
  };

  /* ============================================================
     AUTO PICK MATCH FOR P1
  ============================================================ */
  const autoPickMatchForP1 = (P1) => {
    const locked = enforcePairForP1(P1);
    if (locked?.error) return null;

    if (locked) return findMatchForP1P2(P1, locked);

    const list = [
      findClosestPlayers(P1),
      findMatchForP1(P1),
      getPairForPlayer(P1)
        ? findMatchForP1P2(P1, getPairForPlayer(P1))
        : null
    ].filter(Boolean);

    if (list.length === 0) return null;

    const strict = list.filter(isStrictValidMatch);
    return strict.length ? pickBestMatch(strict) : pickBestMatch(list);
  };



  const getPairForPlayer = (name) => {
    const p = players.find(x => x.Player_Name === name);
    if (!p || !p.Flag_Player) return null;
    return p.Flag_Player.trim();
  };

  const isPairAvailable = (name) => {
    const pair = getPairForPlayer(name);
    if (!pair) return true; // ไม่มีคู่ล๊อค → ใช้ได้ปกติ

    // ต้องมีคู่ล๊อคอยู่ Active ด้วย
    return activePlayers.some(p => p.Player_Name === pair);
  };

  const enforcePairForP1 = (p1Name) => {
    const pair = getPairForPlayer(p1Name);
    if (!pair) return null;

    // คู่ล๊อคต้อง Active ทั้งคู่
    if (!isPairAvailable(p1Name)) {
      return { error: `❌ ${p1Name} มีคู่ล๊อค แต่คู่ไม่อยู่ในสนาม (Inactive)` };
    }

    return pair;  // คืนชื่อคู่ล๊อค เช่น "B"
  };
  const enforcePairForOpposite = (a, b) => {
    const lockA = getFlagPartnerFromPlayers(a);
    const lockB = getFlagPartnerFromPlayers(b);

    // ไม่มีล๊อค → ผ่าน
    if (!lockA && !lockB) return true;

    // ล๊อคแบบ cross เท่านั้นที่ถูกต้อง
    return lockA === b && lockB === a;
  };


  const addMatchToQueue = (match) => {
    setMatchQueue(prev => {
      const newList = [...prev, match];

      // จำกัดคิวไม่เกิน 5 แมท
      if (newList.length > 5) {
        newList.splice(0, newList.length - 5);
      }
      return newList;
    });
  };




  /* ============================================================
     RUN BUTTON HANDLERS (เรียก openPreview)
  ============================================================ */

  const runRandom = () => {
    if (!selectedP1) return alert("กรุณาเลือก P1");

    // ✔ ตรวจคู่ล๊อคก่อนเสมอ
    const locked = enforcePairForP1(selectedP1);
    if (locked?.error) return alert(locked.error);

    if (locked) {
      const match = findMatchForP1P2(selectedP1, locked);
      if (!match) return alert(`❌ คู่ล๊อค ${selectedP1}–${locked} หาคู่ตรงข้ามไม่ได้`);
      return openPreview(match);
    }

    // (ปกติ)
    const match = findMatchForP1(selectedP1);
    if (!match) return alert("ไม่พบคู่ที่สุ่มได้ตามกฎ");

    openPreview(match);
  };

  const runRandom2 = () => {
    if (!selectedP1 || !selectedP2) return alert("เลือก P1 และ P2 ให้ครบ");

    // ✔ ตรวจคู่ล๊อค → ต้องตรงกันเท่านั้น
    const locked = enforcePairForP1(selectedP1);
    if (locked?.error) return alert(locked.error);

    if (locked && locked !== selectedP2)
      return alert(`❌ ${selectedP1} ถูกล๊อคคู่กับ ${locked} เท่านั้น`);

    const match = findMatchForP1P2(selectedP1, selectedP2);
    if (!match) return alert("ไม่พบคู่ตรงข้าม");

    openPreview(match);
  };


  const runRandom3 = () => {
    if (!selectedFixedPair)
      return alert("กรุณาเลือกคู่ล๊อคก่อน");

    const [p1, p2] = selectedFixedPair.split("-");

    const match = findMatchForP1P2(p1, p2);

    // ✔ TEAM2 ต้องเป็นคู่ล๊อคด้วย ถ้ามี
    if (!enforcePairForOpposite(match.p3, match.p4))
      return alert("❌ ทีมตรงข้ามไม่ได้จับคู่ตามคู่ล๊อค");

    if (!match)
      return alert(`คู่ล๊อค ${p1}–${p2} ไม่สามารถสุ่มคู่ตรงข้ามได้`);

    openPreview(match);
  };


  const runRandom4 = () => {
    if (!selectedP1) return alert("กรุณาเลือก P1");

    // ✔ ตรวจคู่ล๊อค
    const locked = enforcePairForP1(selectedP1);
    if (locked?.error) return alert(locked.error);

    if (locked) {
      const match = findMatchForP1P2(selectedP1, locked);
      if (!match) return alert(`ไม่พบคู่ที่เหมาะสมสำหรับคู่ล๊อค`);
      return openPreview(match);
    }

    const match = findClosestPlayers(selectedP1);
    if (!match) return alert("ไม่พบคู่ที่เหมาะสม");

    openPreview(match);
  };
  const getActiveCourtsRealtime = () =>
    courts
      .filter(c =>
        c.Cort_Status === "Active" &&
        !lockedCourtsRef.current.has(c.Cort)
      )
      .map(c => c.Cort);


  const computeHash = () => {
    return JSON.stringify({
      players: players.map(p => ({ n: p.Player_Name, s: p.Player_Status })),
      matchCount,
      partnerHistory,
      opponentHistory
    });
  };
  useEffect(() => {
    if (!autoLoopOn) return;
    if (mode !== "mode5") return;
    if (showPreview) return;                 // ❗ กันเปิดซ้ำ

    const matches = runAutoByActiveCourts(); // ⭐ realtime court

    if (!matches || matches.length === 0) return;

    openPreview(matches[0]);
    // ⭐ เปิดครั้งเดียว
  }, [
    autoLoopOn,
    mode,
    players,
    courts,        // ⭐⭐ สำคัญมาก ต้องมี
  ]);



  useEffect(() => {
    console.log("🔥 COURTS UPDATED", courts);
  }, [courts]);




// ======================
// AUTO MODE PRIORITY
// ======================

const getWaitMs = (name) => {
  const d = lastEnd?.[name];
  if (!d || !Number.isFinite(d.end)) return Infinity;
  return now - d.end;
};

const getPlayedCount = (name) => matchCount?.[name] || 0;

/**
 * Priority:
 * 1) รอเกิน 20 นาที
 * 2) เล่นน้อยที่สุด
 * 3) รอนานกว่า
 */
const sortAutoPriority = (players) => {
  return [...players].sort((a, b) => {
    const wa = getWaitMs(a.Player_Name);
    const wb = getWaitMs(b.Player_Name);

    const aOver = wa >= 20 * 60 * 1000;
    const bOver = wb >= 20 * 60 * 1000;

    // 1️⃣ คนรอเกิน 20 นาที มาก่อน
    if (aOver !== bOver) return aOver ? -1 : 1;

    // 2️⃣ เล่นน้อยกว่ามาก่อน
    const ca = getPlayedCount(a.Player_Name);
    const cb = getPlayedCount(b.Player_Name);
    if (ca !== cb) return ca - cb;

    // 3️⃣ รอนานกว่ามาก่อน
    return wb - wa;
  });
};




 const runAutoMode = () => {
  let active = [...activePlayers];
  if (active.length < 4) return null;

  // ⭐ ใช้ priority ใหม่
  const prioritized = sortAutoPriority(active);
  const P1 = prioritized[0]?.Player_Name;
  if (!P1) return null;

  const locked = enforcePairForP1(P1);
  if (locked?.error) return null;


    if (locked) {
      const m = findMatchForP1P2(P1, locked);
      if (!m) return null;
      if (!enforcePairForOpposite(m.p3, m.p4)) return null;
      return m;
    }

    const candidates = [
      findClosestPlayers(P1),
      findMatchForP1(P1),
      getPairForPlayer(P1)
        ? findMatchForP1P2(P1, getPairForPlayer(P1))
        : null
    ].filter(Boolean);

    if (candidates.length === 0) return null;

    const strict = candidates.filter(isStrictValidMatch);
    return strict.length > 0
      ? pickBestMatch(strict)
      : pickBestMatch(candidates);
  };



  /* ============================================================
  UI
  ============================================================ */
  /* ============================================================
     UI
 ============================================================ */
  return (
    <div className="random-panel responsive-wrapper">
      <button
        style={{ marginRight: 8 }}
        onClick={() => {
          setSelectedP1("");
          setSelectedP2("");
        }}
      >
        เคลียร์
      </button>

      <button
        className="btn-random"
        onClick={() => {
          if (mode === "mode1") runRandom();
          if (mode === "mode2") runRandom2();
          if (mode === "mode3") runRandom3();
          if (mode === "mode4") runRandom4();
          if (mode === "mode5") {
            const matches = runAutoByActiveCourts();
            if (!matches || matches.length === 0) return;

            // ⭐⭐ สำคัญที่สุด: ใช้ openPreview เท่านั้น
            openPreview(matches);
          }


        }}
      >
        🎲 สุ่มตอนนี้
      </button>
      {/* ================= LEFT PANEL ================ */}
      <div className="left-panel">
        <h4>?? Random — โหมดสุ่ม</h4>

        {/* ================= GENDER MODE ================ */}
        <label style={{ marginTop: 10 }}>โหมดเพศ (Gender Mode)</label>
        <Select
          options={[
            { value: "", label: "-- ไม่จำกัดเพศ --" },
            { value: "m2m", label: "ช vs ช" },
            { value: "f2f", label: "ญ vs ญ" },
            { value: "mix", label: "ชญ vs ชญ" },
          ]}
          value={{
            value: genderMode,
            label:
              genderMode === "m2m"
                ? "ช vs ช"
                : genderMode === "f2f"
                  ? "ญ vs ญ"
                  : genderMode === "mix"
                    ? "ชญ vs ชญ"
                    : "-- ไม่จำกัดเพศ --",
          }}
          onChange={(opt) => setGenderMode(opt.value)}
        />

        {/* ================= MODE SELECT ================ */}
        <label>เลือกโหมด</label>
        <Select
          options={[
            { value: "mode1", label: "โหมด 1 — เลือก P1 random P2,P3,P4" },
            { value: "mode2", label: "โหมด 2 — เลือก P1,P2 random P3,P4" },
            { value: "mode3", label: "โหมด 3 — random คู่ล๊อคเจอคู่ตรงข้าม" },
            { value: "mode4", label: "โหมด 4 — เลือก 1 คน หา 3 คน Rank ใกล้เคียง" },
            { value: "mode5", label: "โหมด 5 — Auto (จัดแมทอัตโนมัติ)" }, // ⭐ เพิ่มตรงนี้
          ]}

          value={{
            value: mode,
            label:
              mode === "mode1"
                ? "โหมด 1 — เลือก P1 random P2,P3,P4"
                : mode === "mode2"
                  ? "โหมด 2 — เลือก P1,P2 random P3,P4"
                  : mode === "mode3"
                    ? "โหมด 3 — random คู่ล๊อคเจอคู่ตรงข้าม"
                    : "โหมด 4 — เลือก 1 คน หา 3 คน Rank ใกล้เคียง",
          }}
          onChange={(opt) => setMode(opt.value)}
        />

        {/* ================= COURT ================ */}
        <label style={{ marginTop: 10 }}>Court</label>
        <select value={court} onChange={(e) => setCourt(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* ================= MODE 1 ================= */}
        {mode === "mode1" && (
          <div style={{ marginTop: 12 }}>
            <label>P1</label>
            <Select
              options={playerOptions}
              styles={colourStyles}
              placeholder="ค้นหาชื่อผู้เล่น..."
              value={playerOptions.find((o) => o.value === selectedP1) || null}
              onChange={(opt) => setSelectedP1(opt?.value || "")}
            />
          </div>
        )}

        {/* ================= MODE 2 ================= */}
        {mode === "mode2" && (
          <div style={{ marginTop: 12 }}>
            <label>P1</label>
            <Select
              options={playerOptions}
              styles={colourStyles}
              value={playerOptions.find((o) => o.value === selectedP1) || null}
              placeholder="ค้นหา P1..."
              onChange={(opt) => setSelectedP1(opt?.value || "")}
            />

            {selectedP1 && (
              <>
                <label style={{ marginTop: 8 }}>
                  P2 {genderMode === "mix" ? "(เพศตรงข้าม)" : ""}
                </label>

                <Select
                  options={activePlayers
                    .filter((p) => p.Player_Name !== selectedP1)
                    .filter((p) => {
                      if (genderMode === "mix") {
                        const g1 = activePlayers.find(
                          (x) => x.Player_Name === selectedP1
                        )?.Player_Gender;
                        return p.Player_Gender !== g1;
                      }
                      return true;
                    })
                    .map((p) => ({
                      value: p.Player_Name,
                      label: `${p.Player_Name} (${p.Player_Ranking}) — ${matchCount?.[p.Player_Name] || 0
                        } Match`,
                      gender: p.Player_Gender,
                    }))}
                  styles={colourStyles}
                  placeholder="ค้นหา P2..."
                  value={
                    selectedP2
                      ? {
                        value: selectedP2,
                        label: activePlayers.find(
                          (p) => p.Player_Name === selectedP2
                        )?.Player_Name,
                      }
                      : null
                  }
                  onChange={(opt) => setSelectedP2(opt?.value || "")}
                />
              </>
            )}
          </div>
        )}

        {/* ================= MODE 3 (Fixed Pair Random) ================= */}
        {mode === "mode3" && (
          <div style={{ marginTop: 12 }}>
            <p>
              โหมดนี้จะสุ่มให้คู่ล๊อคเจอคู่ตรงข้าม โดยใช้กฎคะแนนและไม่ซ้ำ partner/opponent
            </p>

            {fixedPairs.length === 0 ? (
              <div style={{ marginTop: 10, color: "red" }}>
                ? ยังไม่มีคู่ล๊อค กรุณาเพิ่มคู่ล๊อคก่อน
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <label><b>เลือกคู่ล๊อค</b></label>

                <select
                  value={selectedFixedPair}
                  onChange={(e) => setSelectedFixedPair(e.target.value)}
                  style={{ width: "100%", padding: 6, marginTop: 5 }}
                >
                  <option value="">-- เลือกคู่ล๊อค --</option>

                  {fixedPairs
                    .filter(pair => {
                      const a = activePlayers.find(p => p.Player_Name === pair[0]);
                      const b = activePlayers.find(p => p.Player_Name === pair[1]);
                      return a && b; // แสดงเฉพาะคู่ Active
                    })
                    .map((pair) => {
                      const key = pair.join("-");
                      return (
                        <option key={key} value={key}>
                          {pair[0]} ?? {pair[1]}
                        </option>
                      );
                    })}
                </select>

                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
                  เลือกคู่ล๊อค แล้วกด “สุ่มตอนนี้”
                </div>
              </div>
            )}
          </div>
        )}


        {/* ================= MODE 4 ================= */}
        {mode === "mode4" && (
          <div style={{ marginTop: 12 }}>
            <label>P1</label>
            <Select
              options={playerOptions}
              styles={colourStyles}
              placeholder="ค้นหา P1..."
              value={playerOptions.find((o) => o.value === selectedP1) || null}
              onChange={(opt) => setSelectedP1(opt?.value || "")}
            />

            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
              ระบบจะหา 3 คนที่มี Rank ใกล้เคียงที่สุด และสุ่มทีมให้สมดุลที่สุด
            </div>
          </div>
        )}
        {mode === "mode5" && (
          <div style={{ marginTop: 12, padding: 10, background: "#e8ffe8", borderRadius: 6 }}>
            <b>โหมด 5 — Auto Mode</b><br />
            • เมื่อมีผู้เล่น Active ครบ 4 คนขึ้นไป ระบบจะจัดแมทให้อัตโนมัติทันที <br />
            • ใช้กฎ rank, คู่ล๊อค และ partner/opponent history เดิมทั้งหมด <br />
            • ไม่ต้องกดปุ่มสุ่ม ระบบทำงานเองอัตโนมัติ
          </div>
        )}

        {/* ================= RUN BUTTON ================ */}
        <div style={{ marginTop: 12 }}>


          {/* ⭐⭐ ปุ่มใหม่: ทำงานเฉพาะโหมด 5 ⭐⭐ */}
          {mode === "mode5" && (
            <div style={{ marginTop: 12, padding: 10, background: "#e8ffe8", borderRadius: 6 }}>
              <b>โหมด 5 — Auto Mode</b><br />
              • ระบบจะจัดแมทให้อัตโนมัติเมื่อผู้เล่นหรือสถานะเปลี่ยน
              <br /><br />

              {!autoLoopOn ? (
                <button
                  style={{ background: "#28a745", color: "white", padding: "6px 12px", marginRight: 8 }}
                  onClick={() => {
                    setAutoLoopOn(true);
                    setLastTriggerHash(""); // reset เพื่อให้เริ่มรันทันที
                  }}
                >
                  ▶ เริ่มสุ่มอัตโนมัติ
                </button>
              ) : (
                <button
                  style={{ background: "#dc3545", color: "white", padding: "6px 12px", marginRight: 8 }}
                  onClick={() => setAutoLoopOn(false)}
                >
                  ⏹ หยุดสุ่มอัตโนมัติ
                </button>
              )}
              <button
                className="btn-auto"
                style={{ background: "#0069d9", color: "white", padding: "6px 12px" }}
                onClick={() => {
                  runAutoByActiveCourts();  // ⭐ จากเดิม while loop
                }}
              >
                ⚡ เติมคิวอัตโนมัติตามคอร์ท
              </button>


            </div>
          )}


        </div>


      </div>

      {/* ================= RIGHT PANEL — FIXED PAIR MANAGEMENT ================ */}
      <div className="fixed-pairs">
        <h4>?? ล๊อคคู่ลูกค้า (Fixed Pairs)</h4>

        <label>คนที่ 1</label>
        <Select
          options={simpleOptions}
          styles={colourStyles}
          placeholder="เลือกคนที่ 1"
          value={simpleOptions.find((x) => x.value === fixedA) || null}
          onChange={(opt) => setFixedA(opt?.value || "")}
        />

        <label style={{ marginTop: 6 }}>คนที่ 2</label>
        <Select
          options={simpleOptions}
          styles={colourStyles}
          placeholder="เลือกคนที่ 2"
          value={simpleOptions.find((x) => x.value === fixedB) || null}
          onChange={(opt) => setFixedB(opt?.value || "")}
        />

        <button style={{ marginTop: 6 }} onClick={addFixedPair}>
          ? เพิ่มคู่ล๊อค
        </button>

        <ul style={{ marginTop: 10 }}>
          {fixedPairs.map((pair) => (
            <li key={pair.join("-")} style={{ marginBottom: 4 }}>
              {pair[0]} ?? {pair[1]}
              <button
                onClick={() => removeFixedPair(pair)}
                style={{ marginLeft: 10 }}
              >
                ? ลบ
              </button>
            </li>
          ))}
        </ul>
      </div><div className="next-matches">
        <h4>📌 คิวแมทถัดไป (สูงสุด 5)</h4>
        {matchQueue.length === 0 ? (
          <div style={{ opacity: 0.6 }}>ยังไม่มีแมทในคิว</div>
        ) : (
          <ul>
            {matchQueue.map((m, i) => (
              <li key={i}>
                #{i + 1}: {m.p1} & {m.p2}  vs  {m.p3} & {m.p4}
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
};

export default RandomPanel;
