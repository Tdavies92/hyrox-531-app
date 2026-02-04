import React, { useState, useMemo } from "react";

// HYROX Pace Calculator — Option B (validated, balanced JSX)

export default function HyroxApp() {
  // --- Inputs ---
  const [oneRm, setOneRm] = useState({ squat: 170, deadlift: 190, bench: 115, press: 70 });
  const [tmPct, setTmPct] = useState(0.9);
  const [lowerInc, setLowerInc] = useState(5);
  const [upperInc, setUpperInc] = useState(2.5);
  const [oneKTime, setOneKTime] = useState("");        // mm:ss (optional)
  const [fiveKTime, setFiveKTime] = useState("25:00"); // mm:ss
  const [hyroxTime, setHyroxTime] = useState("");      // hh:mm:ss (optional)
  const [stationOverheadMin, setStationOverheadMin] = useState(35);
  const [week, setWeek] = useState(1);

  // --- Helpers ---
  const toSeconds = (str) => {
    if (!str) return null;
    const parts = str.split(":").map((p) => Number(p));
    if (parts.some((n) => Number.isNaN(n))) return null;
    if (parts.length === 2) { const [m, s] = parts; return m * 60 + s; }
    if (parts.length === 3) { const [h, m, s] = parts; return h * 3600 + m * 60 + s; }
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

  const speedKph = (secPerKm) => {
    if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm <= 0) return "-";
    return (3600 / secPerKm).toFixed(2);
  };

  const split400 = (secPerKm) => {
    if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm <= 0) return "-";
    return fmtTime(secPerKm * 0.4);
  };

  // --- Derived paces ---
  const oneKSec       = useMemo(() => toSeconds(oneKTime), [oneKTime]);
  const fiveKSec      = useMemo(() => toSeconds(fiveKTime), [fiveKTime]);
  const hyroxTotalSec = useMemo(() => toSeconds(hyroxTime), [hyroxTime]);

  const runOnlySec = useMemo(() => {
    if (!hyroxTotalSec) return null;
    return Math.max(0, hyroxTotalSec - stationOverheadMin * 60);
  }, [hyroxTotalSec, stationOverheadMin]);

  const pace1kTT  = oneKSec ?? null;
  const pace5k    = fiveKSec ? fiveKSec / 5 : null;

  const pace1kEstFrom5k = fiveKSec ? fiveKSec * Math.pow(1 / 5, 1.06) : null;
  const pace8kFromHyrox = runOnlySec ? runOnlySec / 8 : null;
  const pace1kUsed      = pace1kTT ?? pace1kEstFrom5k ?? pace8kFromHyrox ?? null;

  const hyroxPaceSec = pace8kFromHyrox
    ? pace8kFromHyrox
    : (pace5k && pace1kUsed) ? (pace5k + pace1kUsed) / 2 : (pace5k ?? pace1kUsed ?? null);

  const z2Slow     = hyroxPaceSec ? hyroxPaceSec + 90 : (pace5k ? pace5k + 90 : null);
  const z2Fast     = hyroxPaceSec ? hyroxPaceSec + 60 : (pace5k ? pace5k + 60 : null);
  const tempoPace  = fiveKSec ? (fiveKSec * Math.pow(10 / 5, 1.06)) / 10 : (hyroxPaceSec ? hyroxPaceSec - 20 : null);
  const interval1k = (pace1kUsed && pace5k) ? (pace1kUsed * 0.6 + pace5k * 0.4) : pace1kUsed;

  // --- 5/3/1 Engine ---
  const wave = useMemo(() => {
    if ([1,5,9].includes(week))  return [0.65, 0.75, 0.85];
    if ([2,6,10].includes(week)) return [0.70, 0.80, 0.90];
    if ([3,7].includes(week))    return [0.75, 0.85, 0.95];
    if ([4,8].includes(week))    return [0.40, 0.50, 0.60];
    if (week === 11)             return [0.70, 0.80, 0.90];
    return [0.40, 0.50];
  }, [week]);

  const cycle   = useMemo(() => (week <= 4 ? 1 : week <= 8 ? 2 : 3), [week]);
  const monLift = useMemo(() => (week % 2 === 1 ? "Squat" : "Bench"), [week]);
  const friLift = useMemo(() => (week % 2 === 1 ? "Deadlift" : "Press"), [week]);

  const baseTm = (lift) => {
    const v   = lift === "Squat" ? oneRm.squat : lift === "Deadlift" ? oneRm.deadlift : lift === "Bench" ? oneRm.bench : oneRm.press;
    const inc = (lift === "Squat" || lift === "Deadlift") ? lowerInc : upperInc;
    return Math.round((v * tmPct + (cycle - 1) * inc) * 10) / 10;
  };

  const round25 = (x) => Math.round(x / 2.5) * 2.5;

  const monTM   = baseTm(monLift);
  const friTM   = baseTm(friLift);
  const monSets = wave.map((p) => round25(monTM * p));
  const friSets = wave.map((p) => round25(friTM * p));

  const repsByWave = (idx) => {
    if ([1,5,9].includes(week))  return [5,5,5][idx] ?? 5;
    if ([2,6,10].includes(week)) return [3,3,3][idx] ?? 3;
    if ([3,7].includes(week))    return [5,3,1][idx] ?? 1;
    if ([4,8].includes(week))    return [5,5,5][idx] ?? 5;
    if (week === 11)             return [3,3,3][idx] ?? 3;
    return [3,3][idx] ?? 3;
  };

  const monTonnage = monSets.reduce((acc, w, i) => acc + w * repsByWave(i), 0);
  const friTonnage = friSets.reduce((acc, w, i) => acc + w * repsByWave(i), 0);

  // --- UI ---
  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", color: "#111", padding: "16px", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ textAlign: "center", fontWeight: 700 }}>HYROX + 5/3/1 Mobile Dashboard</h1>

      <section style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: 16, marginTop: 12 }}>
        <h2 style={{ fontWeight: 600, marginBottom: 8 }}>Inputs</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {["squat","deadlift","bench","press"].map((lift) => (
            <div key={lift}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                {lift.toUpperCase()} 1RM (kg)
              </label>
              <input
                type="number"
                value={oneRm[lift]}
                onChange={(e)=> setOneRm({ ...oneRm, [lift]: Number(e.target.value) || 0 })}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
              />
            </div>
          ))}

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>TM %</label>
            <input
              type="number"
              step="0.01"
              value={tmPct}
              onChange={(e)=> setTmPct(Number(e.target.value) || 0)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Lower inc/cycle (kg)</label>
            <input
              type="number"
              step="0.5"
              value={lowerInc}
              onChange={(e)=> setLowerInc(Number(e.target.value) || 0)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Upper inc/cycle (kg)</label>
            <input
              type="number"
              step="0.5"
              value={upperInc}
              onChange={(e)=> setUpperInc(Number(e.target.value) || 0)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>1K (mm:ss, optional)</label>
            <input
              type="text"
              placeholder="3:40"
              value={oneKTime}
              onChange={(e)=> setOneKTime(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>5K (mm:ss)</label>
            <input
              type="text"
              placeholder="25:00"
              value={fiveKTime}
              onChange={(e)=> setFiveKTime(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>HYROX (hh:mm:ss, optional)</label>
            <input
              type="text"
              placeholder="1:15:00"
              value={hyroxTime}
              onChange={(e)=> setHyroxTime(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Station Overhead (min)</label>
            <input
              type="number"
              value={stationOverheadMin}
              onChange={(e)=> setStationOverheadMin(Number(e.target.value) || 0)}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Macro Week (1–12)</label>
            <input
              type="number"
              min={1}
              max={12}
              value={week}
              onChange={(e)=> setWeek(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
              style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            />
          </div>
        </div>
      </section>

      <section style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: 16, marginTop: 12 }}>
        <h2 style={{ fontWeight: 600, marginBottom: 8 }}>Pace Targets</h2>

        <div style={{ fontSize: 14, display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>HYROX run-only time</span><span>{fmtTime(runOnlySec)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>HYROX split (8k) pace</span><span>{fmtPace(pace8kFromHyrox)} /km • {speedKph(pace8kFromHyrox)} kph</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>1k TT (used)</span><span>{fmtPace(pace1kUsed)} /km • {speedKph(pace1kUsed)} kph</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>5k pace</span><span>{fmtPace(pace5k)} /km • {speedKph(pace5k)} kph</span></div>
        </div>

        <hr style={{ margin: "10px 0" }} />

        <div style={{ fontSize: 14, display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>HYROX 1k target</span><span>{fmtPace(hyroxPaceSec)} /km • {speedKph(hyroxPaceSec)} kph</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Z2 range</span><span>{fmtPace(z2Slow)} → {fmtPace(z2Fast)} /km</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Tempo</span><span>{fmtPace(tempoPace)} /km • {speedKph(tempoPace)} kph</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Interval (1k)</span><span>{fmtPace(interval1k)} /km • {speedKph(interval1k)} kph</span></div>
        </div>

        <hr style={{ margin: "10px 0" }} />

        <div style={{ fontSize: 14, display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>HYROX 400m split</span><span>{split400(hyroxPaceSec)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Tempo 400m split</span><span>{split400(tempoPace)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Interval 400m split</span><span>{split400(interval1k)}</span></div>
        </div>
      </section>

      <section style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: 16, marginTop: 12 }}>
        <h2 style={{ fontWeight: 600, marginBottom: 8 }}>This Week • 5/3/1</h2>

        <div style={{ fontSize: 14, marginBottom: 6 }}>Mon: <strong>{monLift}</strong> • TM {monTM} kg</div>
        <div style={{ display: "flex", gap: 8, fontSize: 14, marginBottom: 10 }}>
          {monSets.map((w, i) => (
            <span key={`mon-${i}`} style={{ padding: "4px 8px", background: "#f3f4f6", borderRadius: 6 }}>
              S{i + 1}: {w} kg × {repsByWave(i)}
            </span>
          ))}
        </div>

        <div style={{ fontSize: 14, marginBottom: 6 }}>Fri: <strong>{friLift}</strong> • TM {friTM} kg</div>
        <div style={{ display: "flex", gap: 8, fontSize: 14 }}>
          {friSets.map((w, i) => (
            <span key={`fri-${i}`} style={{ padding: "4px 8px", background: "#f3f4f6", borderRadius: 6 }}>
              S{i + 1}: {w} kg × {repsByWave(i)}
            </span>
          ))}
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
          Tonnage this week: Mon {Math.round(monTonnage)} kg • Fri {Math.round(friTonnage)} kg
        </div>
      </section>

      <section style={{ textAlign: "center", fontSize: 12, color: "#6b7280", marginTop: 8 }}>
        No account needed. Data stays in your session. We can add LocalStorage next.
      </section>
    </div>
  );
}
