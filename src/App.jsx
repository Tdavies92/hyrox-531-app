
import React, { useState, useMemo, useEffect } from "react";

// --- Small LocalStorage helper ---
function useSticky(key, initialValue) {
  const [value, setValue] = useState(() => {
    try { const v = localStorage.getItem(key); return v != null ? JSON.parse(v) : initialValue; } catch { return initialValue; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }, [key, value]);
  return [value, setValue];
}

// --- 5/3/1 utility functions ---
const wavePercents = (week) => {
  if ([1,5,9].includes(week))  return [0.65, 0.75, 0.85];
  if ([2,6,10].includes(week)) return [0.70, 0.80, 0.90];
  if ([3,7].includes(week))    return [0.75, 0.85, 0.95];
  if ([4,8].includes(week))    return [0.40, 0.50, 0.60];
  if (week === 11)             return [0.70, 0.80, 0.90];
  return [0.40, 0.50]; // week 12 taper
};

const waveReps = (week) => {
  if ([1,5,9].includes(week))  return [5,5,5];
  if ([2,6,10].includes(week)) return [3,3,3];
  if ([3,7].includes(week))    return [5,3,1];
  if ([4,8].includes(week))    return [5,5,5];
  if (week === 11)             return [3,3,3];
  return [3,3];
};

const isAmrapWeek = (week) => [1,2,3,5,6,7,9,10].includes(week);

const roundTo = (x, step) => Math.round(x / step) * step;

const KG_PER_LB = 0.45359237;

export default function App() {
  // --- Inputs ---
  const [units, setUnits] = useSticky('units', 'kg'); // 'kg' | 'lb'
  const [rm, setRm] = useSticky('rms', { squat: 170, deadlift: 190, bench: 115, press: 70 });
  const [tmPct, setTmPct] = useSticky('tmPct', 0.9);
  const [lowerInc, setLowerInc] = useSticky('lowerInc', 5);   // per 4-week cycle
  const [upperInc, setUpperInc] = useSticky('upperInc', 2.5); // per 4-week cycle
  const [week, setWeek] = useSticky('week', 1);               // 1..12
  const [roundStep, setRoundStep] = useSticky('roundStep', 2.5); // 2.5 kg or 5 lb typically

  const cycle = week <= 4 ? 1 : week <= 8 ? 2 : 3;

  const lifts = [
    { key: 'squat', label: 'Squat', type: 'lower' },
    { key: 'bench', label: 'Bench', type: 'upper' },
    { key: 'deadlift', label: 'Deadlift', type: 'lower' },
    { key: 'press', label: 'Press', type: 'upper' },
  ];

  const toKg = (v) => units === 'kg' ? v : v * KG_PER_LB;
  const fromKg = (v) => units === 'kg' ? v : v / KG_PER_LB;

  const incFor = (type) => (type === 'lower' ? lowerInc : upperInc);

  const computeTmKg = (liftKey, type) => {
    const oneRmInput = toKg(Number(rm[liftKey]) || 0);
    const tm0 = oneRmInput * Number(tmPct);
    const tm = tm0 + (cycle - 1) * incFor(type);
    return tm;
  };

  const weekPercs = wavePercents(week);
  const weekReps  = waveReps(week);

  // Mon/Fri plan: odd weeks = Squat/Deadlift, even = Bench/Press
  const monLift = week % 2 === 1 ? lifts[0] : lifts[1];
  const friLift = week % 2 === 1 ? lifts[2] : lifts[3];

  const calcSets = (lift) => {
    const tmKg = computeTmKg(lift.key, lift.type);
    const sets = weekPercs.map((p) => {
      const loadKg = roundTo(tmKg * p, roundStep);
      const loadDisplay = fromKg(loadKg);
      return { pct: p, kg: loadKg, disp: +loadDisplay.toFixed(1) };
    });
    return { tmKg, tmDisp: +fromKg(tmKg).toFixed(1), sets };
  };

  const mon = calcSets(monLift);
  const fri = calcSets(friLift);

  // Build a 4-week cycle preview for each lift
  const cycleWeeks = [1,2,3,4].map(w => ({ w, percs: wavePercents(w), reps: waveReps(w) }));
  const tmForCycleKg = (lift) => (computeTmKg(lift.key, lift.type) - (cycle-1)*incFor(lift.type)); // TM of cycle 1 baseline

  const tableData = lifts.map(lift => {
    const baseTmKg = tmForCycleKg(lift) + (cycle-1)*incFor(lift.type); // just to show current cycle TM
    const rows = cycleWeeks.map(({w, percs, reps}) => {
      const tmKg = (toKg(Number(rm[lift.key])||0) * tmPct) + (Math.ceil(w/4)-1 + (cycle-1)) * incFor(lift.type); // approximate across 12w if needed
      const sets = percs.map((p,i)=>({
        pct: p,
        disp: +fromKg(roundTo(tmKg*p, roundStep)).toFixed(1),
        reps: reps[i] ?? reps[reps.length-1]
      }));
      return { w, sets };
    });
    return { lift: lift.label, rows };
  });

  // --- UI helpers ---
  const box = { background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 16, marginTop: 12 };
  const input = { width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 };
  const label = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 };

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial', color: '#111', padding: 16, maxWidth: 920, margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', fontWeight: 700 }}>Wendler 5/3/1 Planner</h1>

      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <button onClick={()=> setUnits(units==='kg'?'lb':'kg')} style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
          Units: {units.toUpperCase()} ({units==='kg' ? 'switch to LB' : 'switch to KG'})
        </button>
      </div>

      {/* Inputs */}
      <section style={box}>
        <h2 style={{ fontWeight: 600, marginBottom: 8 }}>Inputs</h2>
        <div style={{ display:'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {lifts.map(l => (
            <div key={l.key}>
              <label style={label}>{l.label} 1RM ({units})</label>
              <input style={input} type="number" value={rm[l.key]} onChange={(e)=> setRm({ ...rm, [l.key]: Number(e.target.value)||0 })} />
            </div>
          ))}
          <div>
            <label style={label}>TM %</label>
            <input style={input} type="number" step="0.01" value={tmPct} onChange={(e)=> setTmPct(Number(e.target.value)||0)} />
          </div>
          <div>
            <label style={label}>Lower inc per cycle ({units})</label>
            <input style={input} type="number" step="0.5" value={units==='kg'?lowerInc: +fromKg(lowerInc).toFixed(1)} onChange={(e)=> setLowerInc(toKg(Number(e.target.value)||0))} />
          </div>
          <div>
            <label style={label}>Upper inc per cycle ({units})</label>
            <input style={input} type="number" step="0.5" value={units==='kg'?upperInc: +fromKg(upperInc).toFixed(1)} onChange={(e)=> setUpperInc(toKg(Number(e.target.value)||0))} />
          </div>
          <div>
            <label style={label}>Rounding step ({units})</label>
            <input style={input} type="number" step="0.5" value={units==='kg'?roundStep: +fromKg(roundStep).toFixed(1)} onChange={(e)=> setRoundStep(toKg(Number(e.target.value)||0))} />
          </div>
          <div>
            <label style={label}>Week (1–12)</label>
            <input style={input} type="number" min={1} max={12} value={week} onChange={(e)=> setWeek(Math.min(12, Math.max(1, Number(e.target.value)||1)))} />
          </div>
        </div>
      </section>

      {/* This Week */}
      <section style={box}>
        <h2 style={{ fontWeight: 600, marginBottom: 8 }}>This Week</h2>
        <p style={{ margin: '6px 0', fontSize: 14 }}>Cycle: <strong>{cycle}</strong> • Wave: <strong>{[1,5,9].includes(week)?'5s': [2,6,10].includes(week)?'3s': [3,7].includes(week)?'5/3/1': [4,8].includes(week)?'Deload': week===11?'Race-prep':'Taper'}</strong> • AMRAP: <strong>{isAmrapWeek(week)?'YES':'NO'}</strong></p>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12 }}>
          {[{title:'Mon', lift:monLift, data:mon}, {title:'Fri', lift:friLift, data:fri}].map(({title,lift,data})=> (
            <div key={title} style={{ border:'1px solid #eee', borderRadius:8, padding:12 }}>
              <div style={{ fontWeight:600, marginBottom:6 }}>{title}: {lift.label} • TM {data.tmDisp.toFixed(1)} {units}</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {data.sets.map((s,i)=> (
                  <span key={i} style={{ padding:'4px 8px', background:'#f3f4f6', borderRadius:6, fontSize:14 }}>
                    S{i+1}: {s.disp.toFixed(1)} {units} @ {(s.pct*100).toFixed(0)}% × {weekReps[i] ?? weekReps[weekReps.length-1]}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4-week cycle preview per lift */}
      <section style={box}>
        <h2 style={{ fontWeight:600, marginBottom:8 }}>Current Cycle (4 weeks) • Rounded loads</h2>
        {tableData.map(block => (
          <div key={block.lift} style={{ marginBottom:12 }}>
            <div style={{ fontWeight:600, marginBottom:6 }}>{block.lift}</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 }}>
              {block.rows.map(r => (
                <div key={r.w} style={{ border:'1px solid #eee', borderRadius:8, padding:8, fontSize:14 }}>
                  <div style={{ fontWeight:600, marginBottom:4 }}>Week {r.w}</div>
                  {r.sets.map((s, i)=> (
                    <div key={i}>S{i+1}: {s.disp.toFixed(1)} {units} @ {(s.pct*100).toFixed(0)}% × {s.reps}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section style={{ textAlign:'center', fontSize:12, color:'#6b7280', marginTop:8 }}>
        Tip: Adjust TM% (common is 0.90) and use small per-cycle increments (5 {units} lower / 2.5 {units} upper).
      </section>
    </div>
  );
}
