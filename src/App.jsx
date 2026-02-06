
import React, { useEffect, useMemo, useState } from "react";

/****************************
 * IronPath 5/3/1 — 4‑day split (v4)
 * Press • Deadlift • Bench • Squat
 * - LocalStorage persistence
 * - Large, mobile‑friendly inputs with +/- steppers (fixed)
 * - Weekly wave calc + top‑set logging
 * - Estimated 1RM (Epley) shown + saved
 * - NEW: Remove items from log + Progress charts (per-lift, est 1RM by week)
 ****************************/

// ---- Small LocalStorage hook ----
function useSticky(key, initialValue) {
  const [value, setValue] = useState(() => {
    try { const v = localStorage.getItem(key); return v != null ? JSON.parse(v) : initialValue; } catch { return initialValue; }
  });
  React.useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }, [key, value]);
  return [value, setValue];
}

const KG_PER_LB = 0.45359237;
const roundTo = (x, step) => Math.round(x / step) * step;

const WAVE_PERCENTS = (week) => {
  if ([1,5,9].includes(week))  return [0.65, 0.75, 0.85];
  if ([2,6,10].includes(week)) return [0.70, 0.80, 0.90];
  if ([3,7].includes(week))    return [0.75, 0.85, 0.95];
  if ([4,8].includes(week))    return [0.40, 0.50, 0.60];
  if (week === 11)             return [0.70, 0.80, 0.90];
  return [0.40, 0.50];
};
const WAVE_REPS = (week) => {
  if ([1,5,9].includes(week))  return [5,5,5];
  if ([2,6,10].includes(week)) return [3,3,3];
  if ([3,7].includes(week))    return [5,3,1];
  if ([4,8].includes(week))    return [5,5,5];
  if (week === 11)             return [3,3,3];
  return [3,3];
};
const isAmrap = (week) => [1,2,3,5,6,7,9,10].includes(week);

const LIFTS = [
  { key: 'press',    label: 'Press',    type: 'upper' },
  { key: 'deadlift', label: 'Deadlift', type: 'lower' },
  { key: 'bench',    label: 'Bench',    type: 'upper' },
  { key: 'squat',    label: 'Squat',    type: 'lower' },
];

// --- Utility: Estimate 1RM from load & reps (Epley: 1RM ≈ w*(1+reps/30)) ---
function epley1RM(load, reps) {
  const r = Math.max(1, Number(reps)||0);
  const w = Number(load)||0;
  return w * (1 + r/30);
}

// --- Step input (mobile friendly + steppers) ---
function StepInput({ label, units, value, setValue, step=1, min=0, max }) {
  const toNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const clamp = (n) => Math.max(min ?? -Infinity, Math.min(max ?? Infinity, toNum(n)));
  const handleChange = (e) => setValue(clamp(e.target.value));
  const plus  = () => setValue(clamp(toNum(value) + step));
  const minus = () => setValue(clamp(toNum(value) - step));
  return (
    <div style={{ display:'grid', gap:6 }}>
      <label style={{ fontSize:12, fontWeight:600 }}>{label}{units?` (${units})`:''}</label>
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:6 }}>
        <input type="number" inputMode="decimal" value={value} onChange={handleChange} onFocus={(e)=> e.target.select()} style={{ width:'100%', padding:12, border:'1px solid #ddd', borderRadius:8, fontSize:16 }} />
        <button type="button" onClick={minus} style={btnStep}>−</button>
        <button type="button" onClick={plus}  style={btnStep}>＋</button>
      </div>
    </div>
  );
}

// --- Tiny line chart (inline SVG) ---
function ChartSVG({ title, units, points, color="#111827" }) {
  // points: array of { x: week (1..12), y: est1rm }
  const width = 280, height = 120, pad = 24;
  const xs = points.map(p=>p.x), ys = points.map(p=>p.y).filter(Number.isFinite);
  const minX = 1, maxX = 12;
  const minY = ys.length? Math.min(...ys) : 0;
  const maxY = ys.length? Math.max(...ys) : 1;
  const yPad = (maxY - minY) * 0.1 || 1;
  const lo = minY - yPad, hi = maxY + yPad;
  const sx = (x)=> pad + ( (x-minX)/(maxX-minX) ) * (width-2*pad);
  const sy = (y)=> height-pad - ( (y-lo)/(hi-lo) ) * (height-2*pad);
  const path = ys.length
    ? points
        .filter(p=>Number.isFinite(p.y))
        .sort((a,b)=>a.x-b.x)
        .map((p,i)=> `${i?'L':'M'}${sx(p.x)},${sy(p.y)}`)
        .join(' ')
    : '';
  return (
    <div style={{ border:'1px solid #eee', borderRadius:8, padding:8 }}>
      <div style={{ fontWeight:600, marginBottom:6 }}>{title}</div>
      <svg width={width} height={height} role="img" aria-label={`${title} chart`}>
        <rect x="0" y="0" width={width} height={height} fill="#fff" />
        {/* axes */}
        <line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} stroke="#e5e7eb" />
        <line x1={pad} y1={pad} x2={pad} y2={height-pad} stroke="#e5e7eb" />
        {/* path */}
        {path && <path d={path} fill="none" stroke={color} strokeWidth="2" />}
        {/* circles */}
        {points.filter(p=>Number.isFinite(p.y)).map((p,i)=> (
          <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="3" fill={color} />
        ))}
        {/* labels */}
        <text x={pad} y={14} fill="#6b7280" fontSize="10">Week 1..12 • {units}</text>
      </svg>
    </div>
  );
}

export default function App() {
  useEffect(()=>{ document.title = 'IronPath 5/3/1'; }, []);

  // Units + rounding
  const [units, setUnits] = useSticky('units', 'kg');
  const toKg   = (v) => units==='kg' ? v : v * KG_PER_LB;
  const fromKg = (v) => units==='kg' ? v : v / KG_PER_LB;
  const defaultRound = units==='kg' ? 2.5 : 5;

  // Inputs persisted
  const [rm, setRm] = useSticky('rms', { squat:170, deadlift:190, bench:115, press:70 });
  const [tmPct, setTmPct] = useSticky('tmPct', 0.9);
  const [incLower, setIncLower] = useSticky('incLower', 5);
  const [incUpper, setIncUpper] = useSticky('incUpper', 2.5);
  const [roundStep, setRoundStep] = useSticky('roundStep', defaultRound);
  const [week, setWeek] = useSticky('week', 1); // 1..12

  // Log (local)
  const [log, setLog] = useSticky('ironpath_log', []);

  useEffect(()=>{ setRoundStep((s)=> s || (units==='kg'?2.5:5)); }, [units]);

  const cycle = week<=4 ? 1 : week<=8 ? 2 : 3;
  const percs = WAVE_PERCENTS(week);
  const reps  = WAVE_REPS(week);
  const incFor = (type) => (type==='lower'? incLower : incUpper);

  const computeTmKg = (liftKey, type) => {
    const orm = toKg(Number(rm[liftKey])||0);
    return orm * Number(tmPct) + (cycle-1)*incFor(type);
  };

  const days = LIFTS.map((lift)=>{
    const tmKg = computeTmKg(lift.key, lift.type);
    const sets = percs.map((p)=>{ const kg = roundTo(tmKg*p, roundStep); return { pct:p, kg, disp:+fromKg(kg).toFixed(1) }; });
    return { lift, tmKg, tmDisp:+fromKg(tmKg).toFixed(1), sets };
  });

  // Save top set including est 1RM (with removable id)
  const saveTopSet = (dayIndex, actualReps) => {
    const d = days[dayIndex];
    const top = d.sets[Math.min(d.sets.length-1, 2)];
    const est = epley1RM(top.disp, actualReps);
    const entry = {
      id: Date.now() + Math.random(),
      ts: new Date().toISOString(), week, cycle,
      lift: d.lift.label, tm: d.tmDisp, units,
      topSet: {
        pct: (top.pct*100).toFixed(0)+'%', load: top.disp, units,
        repsTarget: reps[2] ?? reps[reps.length-1], repsActual: actualReps,
        est1RM: +est.toFixed(1)
      }
    };
    setLog((arr)=> [entry, ...arr].slice(0,300));
  };

  const removeLogItem = (id) => setLog((arr)=> arr.filter(e => e.id !== id));
  const exportLog = () => {
    const blob = new Blob([JSON.stringify(log, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'ironpath_log.json'; a.click(); URL.revokeObjectURL(url);
  };
  const clearLog = () => { if (confirm('Clear all local log entries?')) setLog([]); };

  // ---- Progress data (per-lift, est1RM by week) ----
  function buildSeries(liftLabel) {
    const pts = [];
    for (let w=1; w<=12; w++) {
      // choose latest entry for this lift & week (could also use max)
      const candidates = log.filter(e => e.lift===liftLabel && e.week===w && e.topSet && Number.isFinite(e.topSet.est1RM));
      const latest = candidates.sort((a,b)=> new Date(b.ts) - new Date(a.ts))[0];
      pts.push({ x:w, y: latest ? Number(latest.topSet.est1RM) : NaN });
    }
    return pts;
  }

  const charts = useMemo(()=> (
    LIFTS.map(l => ({ label:l.label, points: buildSeries(l.label) }))
  ), [log, units]);

  return (
    <div style={page}>
      <header style={hdr}>
        <div style={{fontSize:22, fontWeight:800}}>IronPath 5/3/1</div>
        <button onClick={()=> setUnits(units==='kg'?'lb':'kg')} style={btnHeader}>Units: {units.toUpperCase()}</button>
      </header>

      {/* Inputs */}
      <section style={card}>
        <h2 style={h2}>Inputs</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:12 }}>
          {LIFTS.map(l => (
            <StepInput key={l.key} label={`${l.label} 1RM`} units={units} value={rm[l.key]}
              setValue={(v)=> setRm({ ...rm, [l.key]: v })} step={units==='kg'?2.5:5} />
          ))}
          <StepInput label={'TM%'} value={tmPct} setValue={setTmPct} step={0.01} min={0.5} max={1.0} />
          <StepInput label={'Lower inc/cycle'} units={units} value={units==='kg'?incLower:+fromKg(incLower).toFixed(1)} setValue={(v)=> setIncLower(toKg(v))} step={units==='kg'?2.5:5} />
          <StepInput label={'Upper inc/cycle'} units={units} value={units==='kg'?incUpper:+fromKg(incUpper).toFixed(1)} setValue={(v)=> setIncUpper(toKg(v))} step={units==='kg'?1:2.5} />
          <StepInput label={'Rounding step'} units={units} value={units==='kg'?roundStep:+fromKg(roundStep).toFixed(1)} setValue={(v)=> setRoundStep(toKg(v))} step={units==='kg'?0.5:1} />
          <StepInput label={'Week (1–12)'} value={week} setValue={(v)=> setWeek(Math.min(12, Math.max(1, v||1)))} step={1} min={1} max={12} />
        </div>
        <div style={{marginTop:8, fontSize:12, color:'#6b7280'}}>Tip: Use the +/- buttons; inputs auto‑select on focus for quick overwrite.</div>
      </section>

      {/* 4‑Day This Week */}
      <section style={card}>
        <h2 style={h2}>This Week • Cycle {cycle} • {([1,5,9].includes(week)?'5s':[2,6,10].includes(week)?'3s':[3,7].includes(week)?'5/3/1':[4,8].includes(week)?'Deload':week===11?'Race‑prep':'Taper')}</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(1, minmax(0,1fr))', gap:12 }}>
          {days.map((d, idx)=> (
            <div key={d.lift.key} style={dayBox}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8, flexWrap:'wrap' }}>
                <div style={{ fontWeight:700, fontSize:18 }}>{`Day ${idx+1}: ${d.lift.label}`}</div>
                <div style={{ fontSize:13, color:'#374151' }}>TM {d.tmDisp.toFixed(1)} {units}</div>
              </div>
              <div style={{ marginTop:8, display:'flex', gap:8, flexWrap:'wrap' }}>
                {d.sets.map((s,i)=> (
                  <div key={i} style={pill}>{`S${i+1}: ${s.disp.toFixed(1)} ${units} @ ${(s.pct*100).toFixed(0)}% × ${WAVE_REPS(week)[i] ?? WAVE_REPS(week)[WAVE_REPS(week).length-1]}`}</div>
                ))}
              </div>
              <TopSetLogger
                units={units}
                targetReps={WAVE_REPS(week)[2] ?? WAVE_REPS(week)[WAVE_REPS(week).length-1]}
                isAmrap={isAmrap(week)}
                topLoad={d.sets[Math.min(d.sets.length-1, 2)].disp}
                save={(reps)=> saveTopSet(idx, reps)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Progress charts */}
      <section style={card}>
        <h2 style={h2}>Progress • est 1RM (by week)</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:12 }}>
          {charts.map(c => (
            <ChartSVG key={c.label} title={c.label} units={units} points={c.points} />
          ))}
        </div>
      </section>

      {/* Log */}
      <section style={card}>
        <h2 style={h2}>Training Log (local)</h2>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button style={btnPrimary} onClick={exportLog}>Export JSON</button>
          <button style={btnGhost} onClick={clearLog}>Clear</button>
        </div>
        <div style={{ marginTop:12, display:'grid', gap:8 }}>
          {log.length===0 && <div style={{color:'#6b7280', fontSize:14}}>No entries yet — log a top set from the cards above.</div>}
          {log.slice(0,40).map((e)=> (
            <div key={e.id} style={logRow}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'baseline', flexWrap:'wrap' }}>
                <div>
                  <strong>{e.lift}</strong> • W{e.week}/C{e.cycle} • {new Date(e.ts).toLocaleString()}
                </div>
                <button onClick={()=> removeLogItem(e.id)} title="Remove" style={btnTrash}>🗑</button>
              </div>
              <div style={{fontSize:14, color:'#374151'}}>
                Top: {e.topSet.load.toFixed(1)} {e.units} @ {e.topSet.pct} × {e.topSet.repsTarget}
                {typeof e.topSet.repsActual === 'number' ? ` → ${e.topSet.repsActual} reps` : ''}
                {typeof e.topSet.est1RM === 'number' ? ` • est 1RM ${e.topSet.est1RM.toFixed(1)} ${e.units}` : ''}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer style={{textAlign:'center', fontSize:12, color:'#6b7280', margin:'16px 0'}}>© IronPath • Data stays on your device</footer>
    </div>
  );
}

function TopSetLogger({ units, targetReps, isAmrap, topLoad, save }) {
  const [r, setR] = useState(targetReps);
  const est = epley1RM(topLoad, r);
  return (
    <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
      <span style={{ fontSize:13, color:'#374151' }}>Top set reps{isAmrap?' (AMRAP)':''}:</span>
      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
        <button type="button" onClick={()=> setR((v)=> Math.max(0,(Number(v)||0)-1))} style={btnStep}>−</button>
        <input type="number" inputMode="numeric" value={r} onChange={(e)=> setR(Number(e.target.value)||0)} onFocus={(e)=> e.target.select()} style={{ width:84, padding:12, border:'1px solid #ddd', borderRadius:8, fontSize:16 }} />
        <button type="button" onClick={()=> setR((v)=> (Number(v)||0)+1)} style={btnStep}>＋</button>
      </div>
      <button type="button" onClick={()=> save(Number(r)||0)} style={btnPrimary}>Log top set</button>
      <span style={{ fontSize:13, color:'#111' }}>est 1RM: <strong>{Number.isFinite(est)? est.toFixed(1): '-'} {units}</strong></span>
    </div>
  );
}

// ---- styles ----
const page = { fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, Arial', color:'#111', padding:16, maxWidth:980, margin:'0 auto' };
const hdr  = { position:'sticky', top:0, zIndex:10, background:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'8px 0', borderBottom:'1px solid #eee' };
const btnHeader = { padding:'8px 10px', border:'1px solid #ddd', borderRadius:8, background:'#fff', cursor:'pointer' };
const card = { background:'#fff', borderRadius:12, boxShadow:'0 1px 4px rgba(0,0,0,0.08)', padding:16, marginTop:12 };
const h2   = { fontWeight:700, margin:'0 0 8px 0' };
const dayBox = { border:'1px solid #eee', borderRadius:12, padding:12 };
const pill = { padding:'6px 10px', background:'#f3f4f6', borderRadius:999, fontSize:14 };
const btnPrimary = { padding:'10px 14px', background:'#111827', color:'#fff', border:'1px solid #111827', borderRadius:8, cursor:'pointer' };
const btnGhost   = { padding:'10px 14px', background:'#fff', border:'1px solid #d1d5db', borderRadius:8, cursor:'pointer' };
const btnStep    = { padding:'12px 14px', border:'1px solid #ddd', borderRadius:8, background:'#fff', fontSize:20, lineHeight:1, cursor:'pointer' };
const btnTrash   = { padding:'6px 8px', border:'1px solid #ef4444', color:'#ef4444', background:'#fff', borderRadius:6, cursor:'pointer' };
const logRow     = { border:'1px solid #eee', borderRadius:8, padding:10 };
