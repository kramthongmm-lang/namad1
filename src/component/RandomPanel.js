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
  BG: 2,
  BGM: 3,
  NB: 4,
  N: 7,
  NP: 10,
  S: 11,
};
const RANK_INDEX = {
  Baby: 1,
  BG: 2,
  BGM: 3,
  NB: 4,
  N: 5,
  NP: 6,
  S: 7,
};

const getRankGap = (rankA, rankB) => {
  const diff = RANK_INDEX[rankB] - RANK_INDEX[rankA];
  if (diff <= -2) return "-2";
  if (diff >= 2) return "2";
  return String(diff);
};


const RANK_ALLOW = {
  Baby: ["BG"],

  BG: ["Baby", "BG", "BGM", "NB"],

  BGM: ["BG", "NB", "S"],

  NB: ["Baby", "BGM", "N", "NP"],

  N: ["NB", "NP", "S"],

  NP: ["NB", "N", "S"],

  S: ["NP", "N", "NB", "BGM"],
};


const WAIT_20 = 20 * 60 * 1000;

const AUTO_COOLDOWN = 0 * 60 * 1000; // 5 นาที



const rankAllowBoth = (rankA, rankB) => {
  if (!rankA || !rankB) return false;
  return (
    RANK_ALLOW[rankA]?.includes(rankB) ||
    RANK_ALLOW[rankB]?.includes(rankA)
  );
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

  const recentP1Ref = useRef(new Map()); // name -> lastPickTime

  const [court, setCourt] = useState(0);
  const [genderMode, setGenderMode] = useState("");
  const [selectedFixedPair, setSelectedFixedPair] = useState("");
  const [autoRunOnce, setAutoRunOnce] = useState(false);
  const [matchQueue, setMatchQueue] = useState([]);   // ← เก็บแมทถัดไปสูงสุด 5 แมท
  const autoRunningRef = React.useRef(false);
  const autoPreviewLock = React.useRef(false);
  const lockedP1Ref = useRef(null);
  const [STRICT_RANK, setStrictRank] = useState(true);




  const [fixedPairs, setFixedPairs] = useState([]);  // << โหลดจาก DB
  const [fixedA, setFixedA] = useState("");
  const [fixedB, setFixedB] = useState("");
  const recentlyUsedRef = useRef(new Map());

  const [localPlayers, setLocalPlayers] = useState(players);
const [rankExposure, setRankExposure] = useState({});
const [rankTarget, setRankTarget] = useState({
  "-2": 1, // เบามาก
  "-1": 1, // เบา
  "0": 3,  // เท่ากัน
  "1": 2,  // หนัก
  "2": 1,  // หนักมาก
});
const RANK_HARD_LIMIT = {
  "-2": 1,
  "-1": 2,
  "0": Infinity,
  "1": 2,   // ???? ??????? 2
  "2": 1,   // ??????? ??????? 2 (???????? 1 ?????)
};

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
  if (!group) return;

  const fetchExposure = async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/rank-exposure/${group}`
      );

      console.log("RANK EXPOSURE API =", res.data);

      if (res.data?.success) {
        setRankExposure(res.data.exposure || {});
      }
    } catch (err) {
      console.error("FETCH RANK EXPOSURE ERROR:", err);
    }
  };

  fetchExposure();
}, [group]);




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
    const matches = [];
    const used = new Set();

    for (const court of activeCourts) {
      if (activePlayers.length - used.size < 4) break;
      const match = buildAutoMatch();
      if (!match) continue;

      const ps = [match.p1, match.p2, match.p3, match.p4];
      if (ps.some(p => used.has(p))) continue;

      ps.forEach(p => used.add(p));
      matches.push({ ...match, court: court.Cort });

    }

    return matches.length ? matches : null;
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
  useEffect(() => {
    if (!showPreview) {
      lockedCourtsRef.current.clear();
      console.log("♻️ Reset locked courts (preview closed)");
    }
  }, [showPreview]);
  const sortPlayersForSelect = (players) => {
  return [...players].sort((a, b) => {
    const nameA = a.Player_Name;
    const nameB = b.Player_Name;

    const playA = matchCount?.[nameA] || 0;
    const playB = matchCount?.[nameB] || 0;

    // 1?? ????? 0 ??? ????????
    if (playA === 0 && playB !== 0) return -1;
    if (playB === 0 && playA !== 0) return 1;

    // 2?? ?????????????? ????????
    const waitA = lastEnd?.[nameA]?.end
      ? now - lastEnd[nameA].end
      : Infinity;

    const waitB = lastEnd?.[nameB]?.end
      ? now - lastEnd[nameB].end
      : Infinity;

    if (waitA !== waitB) return waitB - waitA;

    // 3?? tie breaker ??????? (?????????)
    return nameA.localeCompare(nameB);
  });
};



const playerOptions = sortPlayersForSelect(activePlayers).map((p) => ({
  value: p.Player_Name,
  label: `${p.Player_Name} (${p.Player_Ranking}) — ${matchCount?.[p.Player_Name] || 0} Match`,
  gender: p.Player_Gender,
}));
useEffect(() => {
  if (!selectedP1 && playerOptions.length > 0) {
    setSelectedP1(playerOptions[0].value);
  }
}, [playerOptions, selectedP1]);

useEffect(() => {
  const exists = playerOptions.some(o => o.value === selectedP1);
  if (!exists && playerOptions.length > 0) {
    setSelectedP1(playerOptions[0].value);
  }
}, [playerOptions, selectedP1]);


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
  // ============================
  // SCORE BALANCE (ใช้ทุกโหมด)
  // ============================
  const isScoreBalanced = (a, b, c, d, maxDiff = 2) => {
    const info = teamScoreInfo(a, b, c, d);
    if (!info) return false;
    return info.diff <= maxDiff;
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


  const recentlyPlayed = (name) => {
    const d = lastEnd?.[name];
    if (!d || !Number.isFinite(d.end)) return false;
    return now - d.end < AUTO_COOLDOWN;
  };
  const autoCandidates = activePlayers.filter(
    p => !recentlyPlayed(p.Player_Name)
  );


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
  const lastMatchRef = useRef({
    opponents: new Set(),   // "A|B"
    partners: new Set()     // "A|B"
  }); const recordLastMatch = (p1, p2, p3, p4) => {
    lastMatchRef.current.opponents = new Set([
      [p1, p3], [p1, p4],
      [p2, p3], [p2, p4],
    ].map(([a, b]) => [a, b].sort().join("|")));

    lastMatchRef.current.partners = new Set([
      [p1, p2].sort().join("|"),
      [p3, p4].sort().join("|"),
    ]);
  };

  const metLastMatch = (a, b) => {
    const key = [a, b].sort().join("|");
    return lastMatchRef.current.opponents.has(key);
  };

  const partneredLastMatch = (a, b) => {
    const key = [a, b].sort().join("|");
    return lastMatchRef.current.partners.has(key);
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
    const base = RANK_ALLOW[rank] ? [...RANK_ALLOW[rank]] : [];
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
          if (
            partneredLastMatch(P1.Player_Name, P2.Player_Name) ||
            partneredLastMatch(p3.Player_Name, p4.Player_Name) ||
            metLastMatch(P1.Player_Name, p3.Player_Name) ||
            metLastMatch(P1.Player_Name, p4.Player_Name) ||
            metLastMatch(P2.Player_Name, p3.Player_Name) ||
            metLastMatch(P2.Player_Name, p4.Player_Name)
          ) continue;
          // ⭐ TEAM2 ต้องล๊อคคู่ถูกต้อง
          if (!enforcePairForOpposite(p3.Player_Name, p4.Player_Name)) continue;

          const okOpp =
            allowedPartnerRanks(p3.Player_Ranking).includes(p4.Player_Ranking) ||
            allowedPartnerRanks(p4.Player_Ranking).includes(p3.Player_Ranking);
          if (!okOpp) continue;

          if (
            !isScoreBalanced(
              P1.Player_Name,
              P2.Player_Name,
              p3.Player_Name,
              p4.Player_Name
            )
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
        // 🚫 MATCH 2 HARD BLOCK — MODE 2
        if (
          partneredLastMatch(p1Name, p2Name) ||
          partneredLastMatch(p3.Player_Name, p4.Player_Name) ||
          metLastMatch(p1Name, p3.Player_Name) ||
          metLastMatch(p1Name, p4.Player_Name) ||
          metLastMatch(p2Name, p3.Player_Name) ||
          metLastMatch(p2Name, p4.Player_Name)
        ) continue;

        // ⭐ TEAM2 ต้องล๊อคตามคู่ล๊อคใน DB
        if (!enforcePairForOpposite(p3.Player_Name, p4.Player_Name)) continue;

        const okOpp =
          allowedPartnerRanks(p3.Player_Ranking).includes(p4.Player_Ranking) ||
          allowedPartnerRanks(p4.Player_Ranking).includes(p3.Player_Ranking);
        if (!okOpp) continue;

        if (
          !isScoreBalanced(
            P1.Player_Name,
            P2.Player_Name,
            p3.Player_Name,
            p4.Player_Name
          )
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

const EXPOSURE_WEIGHT = {
  "-2": 2,  // ?????? (???????)
  "-1": 3,
  "0": 1,
  "1": 5,
  "2": 8,  // ??????? (??????)
};
const RANK_QUOTA_SOFT = {
  "-2": 1,
  "-1": 1,
  "0": 3,
  "1": 2,
  "2": 1,
};


const exposurePenalty = (playerName, opponentName) => {
  const pA = players.find(p => p.Player_Name === playerName);
  const pB = players.find(p => p.Player_Name === opponentName);
  if (!pA || !pB) return 0;

  const gap = getRankGap(
    pA.Player_Ranking,
    pB.Player_Ranking
  );

  const used = rankExposure?.[playerName]?.[gap] ?? 0;
  const hardLimit = RANK_HARD_LIMIT[gap] ?? Infinity;

  // ? HARD BLOCK — ???????????????????????????
  if (used >= hardLimit) {
    return Infinity;
  }

  // ?? soft penalty (?????????)
  return used * 3;
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
  const getActiveCourt = () => {
    const active = courts.filter(c => c.Cort_Status === "Active");
    if (active.length === 0) return null;

    // ถ้ามีหลาย court → สุ่ม
    return active[Math.floor(Math.random() * active.length)].Cort;
  };

 const getFreeCourts = () => {
  const now = Date.now();
  return courts.filter(c =>
    c.Cort_Status === "Active" &&
    (!c.Cort_UpdatedAt || now - new Date(c.Cort_UpdatedAt).getTime() > 1000)
  );
};

const pickAutoSubMode = () => {
  // ปรับ weight ได้ตามต้องการ
  // 0 = mode1, 1 = mode4
  //return Math.random() < 0.7 ? "mode4" : "mode1";

  return Math.random() < 0.5 ? "mode1" : "mode4";
};

const buildAutoMatchByStrategy = () => {
  const p1 = pickRandomP1();
  if (!p1) return null;

  const strategy = pickAutoSubMode();

  let match = null;

  if (strategy === "mode1") {
    match = findMatchForP1(p1);
  }

  if (strategy === "mode4") {
    match = findClosestPlayers(p1);
  }

  if (!match) return null;

  return {
    ...match,
    explanation: `AUTO: ${strategy.toUpperCase()}`
  };
};



  const autoBuildOrQueueMatch = () => {
    if (activePlayers.length < 4) return;

    const match = buildAutoMatchByStrategy();
    if (!match) return;

    const freeCourts = getFreeCourts();

    // ==========================
    // ?? CASE 1: ?? court ????
    // ==========================
    if (freeCourts.length > 0) {
      const c = freeCourts[0].Cort;

      lockedCourtsRef.current.add(c);

      openPreview({
        ...match,
        court: c
      });

      return;
    }

    // ==========================
    // ?? CASE 2: court ???? ? ???????
    // ==========================
    const queuedMatch = {
      ...match,
      court: null,
      queued: true,
      queuedAt: Date.now(),
      explanation:
        (match.explanation || "") + " | ? QUEUED (waiting for court)"
    };

    // 1?? ?????? queue (????? court)
    addMatchToQueue(queuedMatch);

    // 2?? ???? Preview ???? (????????????)
    openPreview(queuedMatch);

    console.log("?? Match queued (no free court)", queuedMatch);

  };

  const pickRandomP1 = () => {
    if (activePlayers.length === 0) return null;

    const sorted = [...activePlayers].sort((a, b) => {
      const playA = getPlayedCount(a.Player_Name);
      const playB = getPlayedCount(b.Player_Name);

      // 1️⃣ คนที่เล่น 0 เกม มาก่อน
      if (playA === 0 && playB !== 0) return -1;
      if (playA !== 0 && playB === 0) return 1;

      // 2️⃣ เล่นน้อยกว่า มาก่อน
      if (playA !== playB) return playA - playB;

      // 3️⃣ รอนานกว่า มาก่อน
      const waitA = getWaitMs(a.Player_Name);
      const waitB = getWaitMs(b.Player_Name);
      if (waitA !== waitB) return waitB - waitA;

      // 4️⃣ กัน tie → สุ่ม
      return Math.random() - 0.5;
    });

    return sorted[0]?.Player_Name || null;
  };






  useEffect(() => {
    if (!autoLoopOn) return;
    if (mode !== "mode5") return;
    if (showPreview) return;

    autoBuildOrQueueMatch();
  }, [autoLoopOn, mode, players, courts]);


  useEffect(() => {
    console.log("🔥 COURTS UPDATED", courts);
  }, [courts]);


  const pickP1 = () => {
    const sorted = [...activePlayers].sort((a, b) => {
      const wa = getWaitMs(a.Player_Name) >= 20 * 60 * 1000;
      const wb = getWaitMs(b.Player_Name) >= 20 * 60 * 1000;
      if (wa !== wb) return wa ? -1 : 1;

      const ca = getPlayedCount(a.Player_Name);
      const cb = getPlayedCount(b.Player_Name);
      if (ca !== cb) return ca - cb;

      return Math.random() - 0.5;
    });

    return sorted[0]?.Player_Name;
  };
  const canBePartner = (nameA, nameB) => {
    const pA = players.find(p => p.Player_Name === nameA);
    const pB = players.find(p => p.Player_Name === nameB);
    if (!pA || !pB) return false;

    // 🔒 คู่ล๊อค
    const lockA = getPairForPlayer(nameA);
    const lockB = getPairForPlayer(nameB);

    if (lockA && lockA !== nameB) return false;
    if (lockB && lockB !== nameA) return false;

    // 🚫 rank
    if (STRICT_RANK && !rankAllowBoth(
      pA.Player_Ranking,
      pB.Player_Ranking
    )) return false;

    // 🚫 partner ซ้ำเกิน 2
    if ((partnerHistory?.[nameA]?.[nameB] || 0) >= 2) return false;

    return true;
  };



  const canBeOpponent = (a, b) => {
    if ((opponentHistory?.[a]?.[b] || 0) >= 2) return false;
    return true;
  };

  const opponentPenalty = (a, b) => {
    const count = opponentHistory?.[a]?.[b] || 0;
    if (count === 0) return 0;
    if (count === 1) return 2;
    return 100; // hard block ที่ >=2
  };
  const sameRank = (a, b) => {
    const A = players.find(p => p.Player_Name === a);
    const B = players.find(p => p.Player_Name === b);
    if (!A || !B) return false;
    return A.Player_Ranking === B.Player_Ranking;
  };
  const canBePartnerStrict = (a, b) => {
    if (!canBePartner(a, b)) return false;
    return sameRank(a, b);
  };
  const teamScoreDiff = (a, b, c, d) => {
    const pa = players.find(p => p.Player_Name === a);
    const pb = players.find(p => p.Player_Name === b);
    const pc = players.find(p => p.Player_Name === c);
    const pd = players.find(p => p.Player_Name === d);
    if (!pa || !pb || !pc || !pd) return Infinity;

    const s1 = getScore(pa.Player_Ranking) + getScore(pb.Player_Ranking);
    const s2 = getScore(pc.Player_Ranking) + getScore(pd.Player_Ranking);

    return Math.abs(s1 - s2);
  };
  const teamScoreInfo = (a, b, c, d) => {
    const pa = players.find(p => p.Player_Name === a);
    const pb = players.find(p => p.Player_Name === b);
    const pc = players.find(p => p.Player_Name === c);
    const pd = players.find(p => p.Player_Name === d);
    if (!pa || !pb || !pc || !pd) return null;

    const teamA =
      getScore(pa.Player_Ranking) +
      getScore(pb.Player_Ranking);

    const teamB =
      getScore(pc.Player_Ranking) +
      getScore(pd.Player_Ranking);

    return {
      teamA,
      teamB,
      diff: Math.abs(teamA - teamB)
    };
  };
  const sameScoreAllFour = (a, b, c, d) => {
    const pa = players.find(p => p.Player_Name === a);
    const pb = players.find(p => p.Player_Name === b);
    const pc = players.find(p => p.Player_Name === c);
    const pd = players.find(p => p.Player_Name === d);
    if (!pa || !pb || !pc || !pd) return false;

    const s = getScore(pa.Player_Ranking);
    return (
      getScore(pb.Player_Ranking) === s &&
      getScore(pc.Player_Ranking) === s &&
      getScore(pd.Player_Ranking) === s
    );
  };
  // ============================
  // SCORE HELPERS
  // ============================
  const sameScoreThreeOfFour = (a, b, c, d) => {
    const names = [a, b, c, d];

    const scores = names
      .map(name => {
        const p = players.find(x => x.Player_Name === name);
        return p ? getScore(p.Player_Ranking) : null;
      })
      .filter(s => s !== null);

    if (scores.length !== 4) return false;

    const countMap = {};
    for (const s of scores) {
      countMap[s] = (countMap[s] || 0) + 1;
    }

    // ?? score ?? score ????? ?????????? 3 ????????
    return Object.values(countMap).some(count => count >= 3);
  };
  const findFourSameScore = (candidates) => {
    const groups = {};

    for (const p of candidates) {
      const score = getScore(p.Player_Ranking);
      if (!groups[score]) groups[score] = [];
      groups[score].push(p.Player_Name);
    }

    // ?? score ????? >= 4 ??
    for (const score in groups) {
      if (groups[score].length >= 4) {
        return shuffle(groups[score]).slice(0, 4);
      }
    }

    return null;
  };
  const getAutoScoreMode = () => {
    const total = Object.values(matchCount || {}).reduce(
      (max, v) => Math.max(max, v),
      0
    );

    // ?????? 1,3,5,... ? sameScore
    // ?????? 2,4,6,... ? sumScore
    return total % 2 === 0 ? "sameScore" : "sumScore";
  };

const canBePartnerByRankGap = (p1, p2, maxGap) => {
  const r1 = getPlayerRank(p1);
  const r2 = getPlayerRank(p2);

  if (maxGap === Infinity) return true;
  return Math.abs(r1 - r2) <= maxGap;
};
const getPlayerRank = (playerName) => {
  const p = players.find(x => x.Player_Name === playerName);
  return p ? RANK_INDEX[p.Player_Ranking] : null;
};


 const buildAutoMatch = () => {
  if (autoCandidates.length < 4) return null;

  const phases = [
    { name: "Phase 1 (Same Rank)", maxGap: 0 },
    { name: "Phase 2 (±1 Rank)", maxGap: 1 },
    { name: "Phase 3 (±2 Rank)", maxGap: 2 },
    { name: "Phase 4 (Free Rank)", maxGap: Infinity },
  ];

  let bestMatch = null;
  let bestScore = Infinity;

  // ????? P1 ??? priority ????????
  const P1 = pickRandomP1();
  if (!P1) return null;

  const P1Obj = players.find(p => p.Player_Name === P1);
  if (!P1Obj) return null;

  for (const phase of phases) {
    const others = shuffle(
      autoCandidates.filter(p => p.Player_Name !== P1)
    );

    for (const p2 of others) {
      const p2Name = p2.Player_Name;

      // -----------------------------
      // Partner rank gap constraint
      // -----------------------------
      if (!canBePartnerByRankGap(P1, p2Name, phase.maxGap)) continue;

      const rest = others.filter(x => x.Player_Name !== p2Name);

      for (let i = 0; i < rest.length; i++) {
        for (let j = i + 1; j < rest.length; j++) {
          const p3 = rest[i].Player_Name;
          const p4 = rest[j].Player_Name;

          // unique guard
          if (new Set([P1, p2Name, p3, p4]).size !== 4) continue;

          // opponent rank gap constraint
          if (!canBePartnerByRankGap(p3, p4, phase.maxGap)) continue;

          // -----------------------------
          // HARD BLOCKS
          // -----------------------------
          if (
            violatesHardLimit(P1, p2Name, p3, p4) ||
            partneredLastMatch(P1, p2Name) ||
            partneredLastMatch(p3, p4) ||
            metLastMatch(P1, p3) ||
            metLastMatch(P1, p4) ||
            metLastMatch(p2Name, p3) ||
            metLastMatch(p2Name, p4)
          ) continue;

          // -----------------------------
          // SCORE BALANCE
          // -----------------------------
          const scoreInfo = teamScoreInfo(P1, p2Name, p3, p4);
          if (!scoreInfo) continue;
          if (scoreInfo.diff > 2) continue;

          // -----------------------------
          // RANK EXPOSURE SCORE
          // -----------------------------
          const exposureScore =
            exposurePenalty(P1, p3) +
            exposurePenalty(P1, p4) +
            exposurePenalty(p2Name, p3) +
            exposurePenalty(p2Name, p4);

          // Infinity = hard reject
          if (!Number.isFinite(exposureScore)) continue;

          // -----------------------------
          // TOTAL SCORE
          // -----------------------------
          const totalScore =
            exposureScore * 8 +     // exposure ????????
            scoreInfo.diff * 2;     // balance ???????

          if (totalScore < bestScore) {
            bestScore = totalScore;

            bestMatch = buildResult(
              players.find(p => p.Player_Name === P1),
              players.find(p => p.Player_Name === p2Name),
              players.find(p => p.Player_Name === p3),
              players.find(p => p.Player_Name === p4),
              [],
              [],
              `AUTO: ${phase.name} | exposure=${exposureScore} | diff=${scoreInfo.diff}`
            );
          }
        }
      }
    }

    // ??? phase ?????? match ??????? ? ??????????? phase
    if (bestMatch && bestScore <= 0) break;
  }

  return bestMatch;
};


useEffect(() => {
  console.log("DEBUG rankExposure state =", rankExposure);
}, [rankExposure]);





  // ===============================
  // AUTO MODE — FULL VERSION
  // ===============================


  // -------------------------------
  // helper: wait / match count
  // -------------------------------
  const getWaitMs = (name) => {
    const d = lastEnd?.[name];
    if (!d || !Number.isFinite(d.end)) return Infinity;
    return now - d.end;
  };

  const getPlayedCount = (name) => matchCount?.[name] || 0;

  // -------------------------------
  // priority sort
  // -------------------------------
  const sortAutoPriority = (list) => {
    return [...list].sort((a, b) => {
      const wa = getWaitMs(a.Player_Name) >= WAIT_20;
      const wb = getWaitMs(b.Player_Name) >= WAIT_20;
      if (wa !== wb) return wa ? -1 : 1;

      const ca = getPlayedCount(a.Player_Name);
      const cb = getPlayedCount(b.Player_Name);
      if (ca !== cb) return ca - cb;

      return Math.random() - 0.5;
    });
  };

  const runAutoSingle = () => {
    if (showPreview) return;
    if (activePlayers.length < 4) return;

    const p1Name = pickRandomP1();
    if (!p1Name) return;

    const match = findMatchForP1(p1Name);
    if (!match) return;

    const c = getActiveCourt();
    if (!c) return;

    match.court = c;
    setCourt(c);
    openPreview(match);
  };


  useEffect(() => {
    if (!autoLoopOn) return;
    if (mode !== "automode") return;
    if (showPreview) return;

    autoBuildOrQueueMatch();
  }, [autoLoopOn, mode, players, courts]);



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
            const match = buildAutoMatchByStrategy();
            if (!match) return;
            openPreview(match);
          }

        }}
      >
        🎲 สุ่มตอนนี้
      </button>
 

      {/* ================= LEFT PANEL ================ */}
      <div className="left-panel">
        <h4>?? Random — โหมดสุ่ม</h4>

        {/* ================= GENDER MODE ================ */}
       

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
                  buildAutoMatch();  // ⭐ จากเดิม while loop
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
