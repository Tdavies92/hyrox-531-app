import React, { useState, useMemo } from "react";

// HYROX Pace Calculator — Option B
// This upgrade adds a full pace engine with: 1k/5k/HYROX inputs, Riegel estimations,
// Z2 banding, Tempo & Intervals, treadmill speeds, and 400m splits.
// No external UI libs so it renders anywhere (ideal for mobile & free hosting).

export default function HyroxApp() {
  // --- Inputs ---
  const [oneRm, setOneRm] = useState({ squat: 170, deadlift: 190, bench: 115, press: 70 });
  const [tmPct, setTmPct] = useState(0.9);
  const [lowerInc, setLowerInc] = useState(5);
  const [upperInc, setUpperInc] = useState(2.5);
  const [oneKTime, setOneKTime] = useState(""); // mm:ss (optional)
  const [fiveKTime, setFiveKTime] = useState("25:00"); // mm:ss
  const [hyroxTime, setHyroxTime] = useState(""); // hh:mm:ss (optional)
  const [stationOverheadMin, setStationOverheadMin] = useState(35);
  const [week, setWeek] = useState(1);

  // --- Helpers ---
  const toSeconds = (str) => {
    if (!str) return null;
    const parts = str.split(":").map((p) => Number(p));
    if (parts.some((n) => Number.isNaN(n))) return null;
    if (parts.length === 2) { // mm:ss
      const [m, s] = parts; return m * 60 + s;
    }
    if (parts.length === 3) { // hh:mm:ss
      const [h, m, s] = parts; return h * 3600 + m * 60 + s;
    }
    const n = Number(str);
    return Number.isFinite(n) ? n : null;
  };
  const fmtTime = (sec) => {
    if (sec == null || !Number.isFinite(sec) || sec <= 0) return "-";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.round(sec % 60).toString().padStart(2, "0");
    return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s}` : `${m}:${s}`;
  };
  const fmtPace = (secPerKm) => {
    if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm <= 0) return "-";
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };
  const speedKph = (secPerKm) => (!secPerKm || !Number.isFinite(secPerKm) || secPerKm <= 0 ? "-" : (3600 / secPerKm).toFixed(2));
  const split400 = (secPerKm) => (!secPerKm || !Number.isFinite(secPerKm) || secPerKm <= 0 ? "-" : fmtTime(secPerKm * 0.4));

  // --- Derived paces (Excel-equivalent logic) ---
  const oneKSec = useMemo(() => toSeconds(oneKTime), [oneKTime]);
  const fiveKSec = useMemo(() => toSeconds(fiveKTime), [fiveKTime]);
  const hyroxTotalSec = useMemo(() => toSeconds(hyroxTime), [hyroxTime]);
  const runOnlySec = useMemo(() => (hyroxTotalSec ? Math.max(0, hyroxTotalSec - stationOverheadMin * 60) : null), [hyroxTotalSec, stationOverheadMin]);

  // Base paces (sec/km)
  const pace1kTT = oneKSec ?? null; // direct 1k time
  const pace5k = fiveKSec ? fiveKSec / 5 : null; // 5k avg pace

  // Estimate 1k from 5k (Riegel), else use HYROX split if available
  const pace1kEstFrom5k = fiveKSec ? fiveKSec * Math.pow(1 / 5, 1.06) : null;
  const pace8kFromHyrox = runOnlySec ? runOnlySec / 8 : null; // HYROX running split
  const pace1kUsed = pace1kTT ?? pace1kEstFrom5k ?? pace8kFromHyrox ?? null;

  // HYROX 1k target pace priority: HYROX split -> blend(5k,1k) -> (whichever exists)
  const hyroxPaceSec = pace8kFromHyrox ?? (pace5k && pace1kUsed ? (pace5k + pace1kUsed) / 2 : pace5k ?? pace1kUsed ?? null);

  // Zones & specialty
  const z2Slow = hyroxPaceSec ? hyroxPaceSec + 90 : (pace5k ? pace5k + 90 : null);
  const z2Fast = hyroxPaceSec ? hyroxPaceSec + 60 : (pace5k ? pace5k + 60 : null);
  const tempoPace = fiveKSec ? (fiveKSec * Math.pow(10 / 5, 1.06)) / 10 : (hyroxPaceSec ? hyroxPaceSec - 20 : null);
  const interval1k = pace1kUsed && pace5k ? (pace1kUsed * 0.6 + pace5k * 0.4) : pace1kUsed;

  // --- 5/3/1 Engine (Mon/Fri alternating) ---
  const wave = useMemo(() => {
    if ([1,5,9].includes(week)) return [0.65, 0.75, 0.85];
    if ([2,6,10].includes(week)) return [0.70, 0.80, 0.90];
    if ([3,7].includes(week)) return [0.75, 0.85, 0.95];
    if ([4,8].includes(week)) return [0.40, 0.50, 0.60];
    if (week === 11) return [0.70, 0.80, 0.90];
    return [0.40, 0.50];
  }, [week]);

  const cycle = useMemo(() => (week <= 4 ? 1 : week <= 8 ? 2 : 3), [week]);
  const monLift = useMemo(() => (week % 2 === 1 ? "Squat" : "Bench"), [week]);
  const friLift = useMemo(() => (week % 2 === 1 ? "Deadlift" : "Press"), [week]);

  const baseTm = (lift) => {
    const v = lift === "Squat" ? oneRm.squat : lift === "Deadlift" ? oneRm.deadlift : lift === "Bench" ? oneRm.bench : oneRm.press;
    const inc = lift === "Squat" || lift === "Deadlift" ? lowerInc : upperInc;
    return Math.round((v * tmPct + (cycle - 1) * inc) * 10) / 10;
  };
  const round25 = (x) => Math.round(x / 2.5) * 2.5;

  const monTM = baseTm(monLift);
  const friTM = baseTm(friLift);
  const monSets = wave.map((p) => round25(monTM * p));
  const friSets = wave.map((p) => round25(friTM * p));
  const repsByWave = (idx) => {
    if ([1,5,9].includes(week)) return [5,5,5][idx] ?? 5;
    if ([2,6,10].includes(week)) return [3,3,3][idx] ?? 3;
    if ([3,7].includes(week)) return [5,3,1][idx] ?? 1;
    if ([4,8].includes(week)) return [5,5,5][idx] ?? 5;
    if (week === 11) return [3,3,3][idx] ?? 3;
    return [3,3][idx] ?? 3;
  };
  const monTonnage = monSets.reduce((acc, w, i) => acc + w * repsByWave(i), 0);
  const friTonnage = friSets.reduce((acc, w, i) => acc + w * repsByWave(i), 0);

  // --- UI ---
  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 text-gray-900">
      <h1 className="text-2xl font-bold text-center">HYROX + 5/3/1 Mobile Dashboard</h1>

      <section className="bg-white rounded-lg shadow p-4 space-y-3">
        <h2 className="text-lg font-semibold">Inputs</h2>
        <div className="grid grid-cols-2 gap-3">
          {["squat","deadlift","bench","press"].map((lift) => (
            <div key={lift}>
