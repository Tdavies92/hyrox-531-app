import React, { useEffect, useMemo, useState } from "react";

// IronPath 5/3/1 — v8.3 (ASCII-only, CSV removed)

function useSticky(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v != null ? JSON.parse(v) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  return [value, setValue];
}

const KG_PER_LB = 0.45359237;
const roundTo = (x, step) => Math.round(x / step) * step;

const WAVE_PERCENTS = (w) => (
  w === 1 ? [0.65, 0.75, 0.85] :
  w === 2 ? [0.70, 0.80, 0.90] :
  w === 3 ? [0.75, 0.85, 0.95] :
            [0.40, 0.50, 0.60]
);
const WAVE_REPS = (w) => (
  w === 1 ? [5,5,5] :
  w === 2 ? [3,3,3] :
  w === 3 ? [5,3,1] :
            [5,5,5]
);
const isAmrapWeek = (w) => [1,2,3].includes(w);

const LIFTS = [
  { key: "press",    label: "Press",    type: "upper",  color: "#ef4444" },
  { key: "deadlift", label: "Deadlift", type: "lower",  color: "#10b981" },
  { key: "bench",    label: "Bench",    type: "upper",  color: "#3b82f6" },
  { key: "squat",    label: "Squat",    type: "lower",  color: "#f59e0b" }
];

function epley1RM(load, reps) {
  const r = Math.max(1, Number(reps) || 0);
  const w = Number(load) || 0;
  return w * (1 + r/30);
}

/* ---------- StepInput (mobile-friendly) ---------- */
function StepInput(props) {
  const { label, units, value, setValue, step=1, min=0, max } = props;
  const toNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const clamp = (n) => {
    const t = toNum(n);
    const lo = (min === undefined || min === null) ? -Infinity : min;
    const hi = (max === undefined || max === null) ?  Infinity  : max;
    return Math.max(lo, Math.min(hi, t));
  };
  const handleChange = (e) => setValue(clamp(e.target.value));
  const plus  = () => setValue(clamp(toNum(value) + step));
  const minus = () => setValue(clamp(toNum(value) - step));

  return (
    <div style={{ display:"grid", gap:6 }}>
      <label style={{ fontSize:12, fontWeight:600 }}>
        {label}{units ? " (" + units + ")" : ""}
      </label>
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:6 }}>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          onFocus={(e)=> e.target.select()}
          style={{ width:"100%", padding:12, border:"1px solid #ddd", borderRadius:8, fontSize:16 }}
        />
        <button type="button" onClick={minus} style={btnStep}>-</button>
        <button type="button" onClick={plus}  style={btnStep}>+</button>
      </div>
    </div>
  );
}

/* ---------- Tiny inline SVG line chart ---------- */
function ChartSVG({ title, units, series, xMax, height=140 }) {
  const width = 340, pad = 28;
  const allPoints = series.flatMap(s => s.points.filter(p => Number.isFinite(p.y)));
  const maxX = xMax != null ? xMax : (allPoints.length ? Math.max(...allPoints.map(p=>p.x)) : 4);
  const ys = allPoints.map(p=>p.y);
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 1;
  const yPad = (maxY - minY) * 0.1 || 1;
  const lo = minY - yPad, hi = maxY + yPad;
  const sx = (x)=> pad + ( (x - 1) / ( (maxX - 1) || 1 ) ) * (width - 2*pad);
  const sy = (y)=> height - pad - ( ( (y - lo) / ( (hi - lo) || 1 ) ) * (height - 2*pad) );
  const buildPath = (pts)=> pts
    .filter(p=>Number.isFinite(p.y))
    .sort((a,b)=>a.x-b.x)
    .map((p,i)=> (i ? "L" : "M") + sx(p.x) + "," + sy(p.y))
    .join(" ");

  return (
    <div style={{ border:"1px solid #eee", borderRadius:8, padding:8 }}>
      <div style={{ fontWeight:700, marginBottom:6 }}>{title}</div>
      <svg width={width} height={height} role="img" aria-label={title + " chart"}>
        <rect x="0" y="0" width={width} height={height} fill="#fff" />
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#e5e7eb" />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#e5e7eb" />
        {series.map(s => (<path key={s.label} d={buildPath(s.points)} fill="none" stroke={s.color} strokeWidth="2" />))}
