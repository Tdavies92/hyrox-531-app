import React, { useEffect, useMemo, useState } from 'react'

// IronPath 5/3/1 — v8.1 (CSV removed; ASCII-only)
// - 4-day split
// - Cycle + Week selectors
// - Local log with remove/export (JSON only); est 1RM (Epley)
// - Per-lift charts (inline SVG)
// - Mobile-friendly stepper inputs

function useSticky(key, initialValue) {
  const [value, setValue] = useState(() => {
    try { const v = localStorage.getItem(key); return v != null ? JSON.parse(v) : initialValue } catch { return initialValue }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)) } catch {} }, [key, value])
  return [value, setValue]
}

const KG_PER_LB = 0.45359237
const roundTo = (x, step) => Math.round(x / step) * step

const WAVE_PERCENTS = (w) => (w===1?[0.65,0.75,0.85]: w===2?[0.70,0.80,0.90]: w===3?[0.75,0.85,0.95]: [0.40,0.50,0.60])
const WAVE_REPS     = (w) => (w===1?[5,5,5]          : w===2?[3,3,3]          : w===3?[5,3,1]          : [5,5,5])
const isAmrapWeek   = (w) => [1,2,3].includes(w)

const LIFTS = [
  { key: 'press',    label: 'Press',    type: 'upper',  color:'#ef4444' },
  { key: 'deadlift', label: 'Deadlift', type: 'lower',  color:'#10b981' },
  { key: 'bench',    label: 'Bench',    type: 'upper',  color:'#3b82f6' },
  { key: 'squat',    label: 'Squat',    type: 'lower',  color:'#f59e0b' },
]

function epley1RM(load, reps) {
  const r = Math.max(1, Number(reps) || 0)
  const w = Number(load) || 0
  return w * (1 + r/30)
}

function StepInput({ label, units, value, setValue, step=1, min=0, max }) {
  const toNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0)
  const clamp = (n) => Math.max(min ?? -Infinity, Math.min(max ?? Infinity, toNum(n)))
  const handleChange = (e) => setValue(clamp(e.target.value))
  const plus  = () => setValue(clamp(toNum(value) + step))
  const minus = () => setValue(clamp(toNum(value) - step))
  return (
    <div style={{ display:'grid', gap:6 }}>
      <label style={{ fontSize:12, fontWeight:600 }}>{label}{units?` (${units})`:''}</label>
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:6 }}>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          onFocus={(e)=> e.target.select()}
          style={{ width:'100%', padding:12, border:'1px solid #ddd', borderRadius:8, fontSize:16 }}
        />
        <button type="button" onClick={minus} style={btnStep}>-</button>
