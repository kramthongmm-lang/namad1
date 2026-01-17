// utils/rankExposure.js

export const RANK_INDEX = {
  Baby: 1,
  BG: 2,
  BGM: 3,
  NB: 4,
  N: 5,
  NP: 6,
  S: 7,
};

export const getRankGap = (rankA, rankB) => {
  if (!rankA || !rankB) return null;

  const diff = RANK_INDEX[rankB] - RANK_INDEX[rankA];
  if (diff <= -2) return "-2";
  if (diff >= 2) return "2";
  return String(diff); // "-1" | "0" | "1"
};

export const GAP_LABEL = {
  "-2": "เบามาก",
  "-1": "เบา",
  "0": "ปกติ",
  "1": "หนัก",
  "2": "หนักมาก",
};

export const GAP_COLOR = {
  "-2": "#4CAF50",
  "-1": "#8BC34A",
  "0": "#FFFFFF",
  "1": "#FF9800",
  "2": "#F44336",
};
