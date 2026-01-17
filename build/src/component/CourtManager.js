// CourtManager.js
import { useState, useCallback, useEffect } from "react";

export function useCourtManager({ courts = 8, onStartMatch } = {}) {
  const [courtStatus, setCourtStatus] = useState({});
  const [courtQueue, setCourtQueue] = useState({});

  // Init courts
  useEffect(() => {
    const s = {};
    const q = {};
    for (let i = 1; i <= courts; i++) {
      s[i] = { status: "idle", match: null };
      q[i] = [];
    }
    setCourtStatus(s);
    setCourtQueue(q);
  }, [courts]);

  /* -------------------- START MATCH -------------------- */
  const startMatchOnCourt = useCallback(
    (court, match) => {
      setCourtStatus((prev) => ({
        ...prev,
        [court]: { status: "playing", match },
      }));
      if (typeof onStartMatch === "function") onStartMatch(match);
    },
    [onStartMatch]
  );

  /* -------------------- ADD TO QUEUE -------------------- */
  const enqueueMatch = useCallback((court, match) => {
    setCourtQueue((prev) => ({
      ...prev,
      [court]: [...prev[court], match],
    }));
  }, []);

  /* -------------------- DISPATCH MATCH -------------------- */
 const handleMatchDispatch = useCallback(
  (match) => {
    const court = String(match.court);   // ⭐ แปลงให้ตรง key
    const status = courtStatus[court];

    if (!status) return { action: "invalid-court" };

    // ถ้ากำลังเล่น → เข้า queue
    if (status.status === "playing") {
      setCourtQueue((prev) => ({
        ...prev,
        [court]: [...prev[court], match],
      }));
      return { action: "enqueued", court };
    }

    // ถ้า queue มีค้างอยู่ → ดัน match เข้า queue
    if (courtQueue[court].length > 0) {
      setCourtQueue((prev) => ({
        ...prev,
        [court]: [...prev[court], match],
      }));
      return { action: "enqueued", court };
    }

    // คอร์ทว่าง → start เลย
    startMatchOnCourt(court, match);
    return { action: "started", court };
  },
  [courtStatus, courtQueue, startMatchOnCourt]
);


  /* -------------------- FINISH COURT -------------------- */
 const finishCourt = useCallback(
  (courtNumber) => {
    const court = String(courtNumber);  // ⭐ ป้องกัน key mismatch

    const queue = courtQueue[court];

    // มีแมตช์รอ → ดึงตัวแรกขึ้นเล่น
    if (queue.length > 0) {
      const [next, ...rest] = queue;

      // 1) อัปเดต queue ก่อน
      setCourtQueue((prev) => ({
        ...prev,
        [court]: rest,
      }));

      // 2) ค่อย start แมตช์
      startMatchOnCourt(court, next);

      return { action: "started-next", next };
    }

    // ไม่มี queue → set idle
    setCourtStatus((prev) => ({
      ...prev,
      [court]: { status: "idle", match: null },
    }));

    return { action: "idle" };
  },
  [courtQueue, startMatchOnCourt]
);


  return {
    courtStatus,
    courtQueue,
    handleMatchDispatch,
    finishCourt,
  };
}
