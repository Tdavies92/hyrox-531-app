
import React, { useEffect, useMemo, useState } from 'react'

// IronPath 5/3/1 — v8 (ASCII clean)
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
function epley1RM(load, reps){ const r=Math.max(1,Number(reps)||0); const w=Number(load)||0; return w*(1+r/30) }

function StepInput({ label, units, value, setValue, step=1, min=0, max }){
  const toNum = (x)=> (Number.isFinite(Number(x))? Number(x): 0)
  const clamp = (n)=> Math.max(min ?? -Infinity, Math.min(max ?? Infinity, toNum(n)))
  const onChange = (e)=> setValue(clamp(e.target.value))
  const plus = ()=> setValue(clamp(toNum(value)+step))
  const minus= ()=> setValue(clamp(toNum(value)-step))
  return (
    <div style={{display:'grid',gap:6}}>
      <label style={{fontSize:12,fontWeight:600}}>{label}{units?` (${units})`:''}</label>
      <div style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:6}}>
        <input type="number" inputMode="decimal" value={value} onChange={onChange} onFocus={(e)=>e.target.select()} style={{width:'100%',padding:12,border:'1px solid #ddd',borderRadius:8,fontSize:16}} />
        <button type="button" onClick={minus} style={btnStep}>-</button>
        <button type="button" onClick={plus}  style={btnStep}>+</button>
      </div>
    </div>
  )
}

function ChartSVG({ title, units, series, xMax, height=140 }){
  const width=340, pad=28
  const allPoints = series.flatMap(s=> s.points.filter(p=> Number.isFinite(p.y)))
  const maxX = xMax ?? (allPoints.length? Math.max(...allPoints.map(p=>p.x)) : 4)
  const ys = allPoints.map(p=>p.y)
  const minY = ys.length? Math.min(...ys):0
  const maxY = ys.length? Math.max(...ys):1
  const yPad = (maxY-minY)*0.1 || 1
  const lo=minY-yPad, hi=maxY+yPad
  const sx=(x)=> pad + (x-1)/(maxX-1 || 1) * (width-2*pad)
  const sy=(y)=> height-pad - ((y-lo)/(hi-lo)) * (height-2*pad)
  const path=(pts)=> pts.filter(p=>Number.isFinite(p.y)).sort((a,b)=>a.x-b.x).map((p,i)=>`${i?'L':'M'}${sx(p.x)},${sy(p.y)}`).join(' ')
  return (
    <div style={{border:'1px solid #eee',borderRadius:8,padding:8}}>
      <div style={{fontWeight:700,marginBottom:6}}>{title}</div>
      <svg width={width} height={height} role="img" aria-label={`${title} chart`}>
        <rect x="0" y="0" width={width} height={height} fill="#fff" />
        <line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} stroke="#e5e7eb" />
        <line x1={pad} y1={pad} x2={pad} y2={height-pad} stroke="#e5e7eb" />
        {series.map(s=> (<path key={s.label} d={path(s.points)} fill="none" stroke={s.color} strokeWidth="2" />))}
        {series.map(s=> s.points.filter(p=>Number.isFinite(p.y)).map((p,i)=> (<circle key={`${s.label}-${i}`} cx={sx(p.x)} cy={sy(p.y)} r="3" fill={s.color} />)))}
        <text x={pad} y={14} fill="#6b7280" fontSize="10">Training weeks • {units}</text>
      </svg>
    </div>
  )
}

export default function App(){
  useEffect(()=>{ document.title='IronPath 5/3/1' },[])
  const [units,setUnits]=useSticky('units','kg')
  const toKg=(v)=> units==='kg'? v: v*KG_PER_LB
  const fromKg=(v)=> units==='kg'? v: v/KG_PER_LB
  const defaultRound= units==='kg'?2.5:5
  const [rm,setRm]=useSticky('rms',{squat:170,deadlift:190,bench:115,press:70})
  const [tmPct,setTmPct]=useSticky('tmPct',0.9)
  const [incLower,setIncLower]=useSticky('incLower',5)
  const [incUpper,setIncUpper]=useSticky('incUpper',2.5)
  const [roundStep,setRoundStep]=useSticky('roundStep',defaultRound)
  const [cycle,setCycle]=useSticky('cycle',1)
  const [weekInCycle,setWeekInCycle]=useSticky('weekInCycle',1)
  const [log,setLog]=useSticky('ironpath_log',[])
  useEffect(()=>{ setRoundStep((s)=> s || (units==='kg'?2.5:5)) },[units])

  const percs=WAVE_PERCENTS(weekInCycle)
  const reps =WAVE_REPS(weekInCycle)
  const incFor=(t)=> t==='lower'? incLower: incUpper

  const computeTmKg=(key,type)=>{ const orm=toKg(Number(rm[key])||0); return orm*Number(tmPct)+(cycle-1)*incFor(type) }
  const days=LIFTS.map(l=>{ const tmKg=computeTmKg(l.key,l.type); const sets=percs.map(p=>{ const kg=roundTo(tmKg*p,roundStep); return {pct:p,kg,disp:+fromKg(kg).toFixed(1)} }); return {lift:l,tmKg,tmDisp:+fromKg(tmKg).toFixed(1),sets} })
  const absWeek=(cy,w)=> (Math.max(1,cy)-1)*4 + Math.min(4,Math.max(1,w))

  const saveTopSet=(dayIndex,actualReps)=>{
    const d=days[dayIndex]; const top=d.sets[Math.min(d.sets.length-1,2)]; const est=epley1RM(top.disp,actualReps)
    const entry={ id:Date.now()+Math.random(), ts:new Date().toISOString(), cycle, week:weekInCycle, absWeek:absWeek(cycle,weekInCycle), lift:d.lift.label, tm:d.tmDisp, units,
      topSet:{ pct:(top.pct*100).toFixed(0)+'%', load:top.disp, units, repsTarget: reps[2] ?? reps[reps.length-1], repsActual: actualReps, est1RM:+est.toFixed(1) } }
    setLog(arr=> [entry, ...arr].slice(0,500))
  }

  const removeLogItem=(id)=> setLog(arr=> arr.filter(e=> e.id!==id))

  const exportJSON=()=>{ const blob=new Blob([JSON.stringify(log,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='ironpath_log.json'; a.click(); URL.revokeObjectURL(url) }

  const exportCSV=()=>{
    const header=['timestamp','cycle','week','absWeek','lift','units','tm','top_pct','top_load','reps_target','reps_actual','est1rm']
    const rows=log.map(e=>[ e.ts, e.cycle, e.week, e.absWeek ?? absWeek(e.cycle,e.week), e.lift, e.units, (e.tm ?? ''), (e.topSet?.pct ?? ''), (Number.isFinite(e.topSet?.load)? e.topSet.load.toFixed(1): ''), (e.topSet?.repsTarget ?? ''), (typeof e.topSet?.repsActual==='number'? e.topSet.repsActual: ''), (Number.isFinite(e.topSet?.est1RM)? e.topSet.est1RM.toFixed(1): '') ])
    const escapeCell=(x)=>{ const s=String(x ?? ''); const needsQuotes = s.includes(',') || s.includes('"') || s.includes('
'); return needsQuotes? '"'+s.replace(/"/g,'""')+'"' : s }
    const csv=[header,...rows].map(r=> r.map(escapeCell).join(',')).join('
')
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='ironpath_log.csv'; a.click(); URL.revokeObjectURL(url)
  }

  const clearLog=()=>{ if (confirm('Clear all local log entries?')) setLog([]) }

  function seriesForLift(label){
    const entries=log.filter(e=> e.lift===label && e.topSet && Number.isFinite(e.topSet.est1RM))
    const maxX= entries.length? Math.max(...entries.map(e=> e.absWeek ?? absWeek(e.cycle,e.week))) : absWeek(cycle,weekInCycle)
    const pts=[]; for(let x=1;x<=maxX;x++){ const cands=entries.filter(e=> (e.absWeek ?? absWeek(e.cycle,e.week))===x); const latest=cands.sort((a,b)=> new Date(b.ts)-new Date(a.ts))[0]; pts.push({x, y: latest? Number(latest.topSet.est1RM): NaN}) }
    return pts
  }
  const perLiftSeries=useMemo(()=> LIFTS.map(l=>({label:l.label,color:l.color,points:seriesForLift(l.label)})), [log,units,cycle,weekInCycle])

  return (
    <div style={page}>
      <header style={hdr}>
        <div style={{fontSize:22,fontWeight:800}}>IronPath 5/3/1</div>
        <button onClick={()=> setUnits(units==='kg'?'lb':'kg')} style={btnHeader}>Units: {units.toUpperCase()}</button>
      </header>

      <section style={card}>
        <h2 style={h2}>Inputs</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:12}}>
          {LIFTS.map(l=> (<StepInput key={l.key} label={`${l.label} 1RM`} units={units} value={rm[l.key]} setValue={(v)=> setRm({...rm,[l.key]:v})} step={units==='kg'?2.5:5} />))}
          <StepInput label={'TM%'} value={tmPct} setValue={setTmPct} step={0.01} min={0.5} max={1.0} />
          <StepInput label={'Lower inc/cycle'} units={units} value={units==='kg'?incLower:+fromKg(incLower).toFixed(1)} setValue={(v)=> setIncLower(toKg(v))} step={units==='kg'?2.5:5} />
          <StepInput label={'Upper inc/cycle'} units={units} value={units==='kg'?incUpper:+fromKg(incUpper).toFixed(1)} setValue={(v)=> setIncUpper(toKg(v))} step={units==='kg'?1:2.5} />
          <StepInput label={'Rounding step'} units={units} value={units==='kg'?roundStep:+fromKg(roundStep).toFixed(1)} setValue={(v)=> setRoundStep(toKg(v))} step={units==='kg'?0.5:1} />
          <StepInput label={'Cycle'} value={cycle} setValue={setCycle} step={1} min={1} max={99} />
          <StepInput label={'Week in Cycle (1–4)'} value={weekInCycle} setValue={setWeekInCycle} step={1} min={1} max={4} />
        </div>
        <div style={{marginTop:8,fontSize:12,color:'#6b7280'}}>Tip: Use the +/- buttons; inputs auto-select on focus for quick overwrite.</div>
      </section>

      <section style={card}>
        <h2 style={h2}>This Week • Cycle {cycle} • {weekInCycle===1?'5s':weekInCycle===2?'3s':weekInCycle===3?'5/3/1':'Deload'}</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(1, minmax(0,1fr))',gap:12}}>
          {days.map((d,idx)=> (
            <div key={d.lift.key} style={dayBox}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8,flexWrap:'wrap'}}>
                <div style={{fontWeight:700,fontSize:18}}>{`Day ${idx+1}: ${d.lift.label}`}</div>
                <div style={{fontSize:13,color:'#374151'}}>TM {d.tmDisp.toFixed(1)} {units}</div>
              </div>
              <div style={{marginTop:8,display:'flex',gap:8,flexWrap:'wrap'}}>
                {d.sets.map((s,i)=> (<div key={i} style={{...pill,background:d.lift.color+"20"}}>{`S${i+1}: ${s.disp.toFixed(1)} ${units} @ ${(s.pct*100).toFixed(0)}% × ${reps[i] ?? reps[reps.length-1]}`}</div>))}
              </div>
              <TopSetLogger units={units} targetReps={reps[2] ?? reps[reps.length-1]} isAmrap={isAmrapWeek(weekInCycle)} topLoad={d.sets[Math.min(d.sets.length-1, 2)].disp} save={(r)=> saveTopSet(idx, r)} />
            </div>
          ))}
        </div>
      </section>

      <section style={card}>
        <h2 style={h2}>Per-Lift • est 1RM</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))',gap:12}}>
          {perLiftSeries.map(s=> (<ChartSVG key={s.label} title={s.label} units={units} series={[s]} />))}
        </div>
      </section>

      <section style={card}>
        <h2 style={h2}>Training Log (local)</h2>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button style={btnPrimary} onClick={exportJSON}>Export JSON</button>
          <button style={btnPrimary} onClick={exportCSV}>Export CSV</button>
          <button style={btnGhost} onClick={clearLog}>Clear</button>
        </div>
        <div style={{marginTop:12,display:'grid',gap:8}}>
          {log.length===0 && <div style={{color:'#6b7280',fontSize:14}}>No entries yet — log a top set from the cards above.</div>}
          {log.slice(0,50).map(e=> (
            <div key={e.id} style={logRow}>
              <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'baseline',flexWrap:'wrap'}}>
                <div><strong>{e.lift}</strong> • Cycle {e.cycle}, Week {e.week} • {new Date(e.ts).toLocaleString()}</div>
                <button onClick={()=> removeLogItem(e.id)} title="Remove" style={btnTrash}>🗑</button>
              </div>
              <div style={{fontSize:14,color:'#374151'}}>
                Top: {e.topSet.load.toFixed(1)} {e.units} @ {e.topSet.pct} × {e.topSet.repsTarget}
                {typeof e.topSet.repsActual === 'number' ? ` → ${e.topSet.repsActual} reps` : ''}
                {typeof e.topSet.est1RM === 'number' ? ` • est 1RM ${e.topSet.est1RM.toFixed(1)} ${e.units}` : ''}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer style={{textAlign:'center',fontSize:12,color:'#6b7280',margin:'16px 0'}}>© IronPath • Data stays on your device</footer>
    </div>
  )
}

function TopSetLogger({units,targetReps,isAmrap,topLoad,save}){
  const [r,setR]=useState(targetReps)
  const est=epley1RM(topLoad,r)
  return (
    <div style={{marginTop:10,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
      <span style={{fontSize:13,color:'#374151'}}>Top set reps{isAmrap?' (AMRAP)':''}:</span>
      <div style={{display:'flex',gap:6,alignItems:'center'}}>
        <button type="button" onClick={()=> setR(v=> Math.max(0,(Number(v)||0)-1))} style={btnStep}>-</button>
        <input type="number" inputMode="numeric" value={r} onChange={(e)=> setR(Number(e.target.value)||0)} onFocus={(e)=> e.target.select()} style={{width:84,padding:12,border:'1px solid #ddd',borderRadius:8,fontSize:16}} />
        <button type="button" onClick={()=> setR(v=> (Number(v)||0)+1)} style={btnStep}>+</button>
      </div>
      <button type="button" onClick={()=> save(Number(r)||0)} style={btnPrimary}>Log top set</button>
      <span style={{fontSize:13,color:'#111'}}>est 1RM: <strong>{Number.isFinite(est)? est.toFixed(1): '-'} {units}</strong></span>
    </div>
  )
}

const page={fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, Arial',color:'#111',padding:16,maxWidth:1000,margin:'0 auto'}
const hdr ={position:'sticky',top:0,zIndex:10,background:'#fff',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'8px 0',borderBottom:'1px solid #eee'}
const btnHeader={padding:'8px 10px',border:'1px solid #ddd',borderRadius:8,background:'#fff',cursor:'pointer'}
const card={background:'#fff',borderRadius:12,boxShadow:'0 1px 4px rgba(0,0,0,0.08)',padding:16,marginTop:12}
const h2  ={fontWeight:700,margin:'0 0 8px 0'}
const dayBox={border:'1px solid #eee',borderRadius:12,padding:12}
const pill={padding:'6px 10px',background:'#f3f4f6',borderRadius:999,fontSize:14}
const btnPrimary={padding:'10px 14px',background:'#111827',color:'#fff',border:'1px solid #111827',borderRadius:8,cursor:'pointer'}
const btnGhost  ={padding:'10px 14px',background:'#fff',border:'1px solid #d1d5db',borderRadius:8,cursor:'pointer'}
const btnStep   ={padding:'12px 14px',border:'1px solid #ddd',borderRadius:8,background:'#fff',fontSize:20,lineHeight:1,cursor:'pointer'}
const btnTrash  ={padding:'6px 8px',border:'1px solid #ef4444',color:'#ef4444',background:'#fff',borderRadius:6,cursor:'pointer'}
const logRow    ={border:'1px solid #eee',borderRadius:8,padding:10}
