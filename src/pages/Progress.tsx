import { useState } from 'react'
import { useData } from '../context/DataContext'
import { volumeOf, todayKey, addDays, weekStart, MONTHS, formatDMYWIB } from '../lib/date'
import { fmtNumber, getExerciseName, exerciseIsDuration } from '../lib/helpers'
import { SBD_LIFTS, isSbdExercise } from '../lib/sbd'
import { e1rm, e1rmStr, e1rmKg } from '../lib/e1rm'
import { secondaryFactorsFor } from '../lib/muscles'
import StatCard from '../components/StatCard'
import { computePosition, get531Sequence, computeExcludedTypes } from '../lib/progression'
import type { Exercise, Session } from '../types'

export default function Progress() {
  const { sessions, exercises, settings } = useData()

  const today = todayKey()
  const [volPage, setVolPage] = useState(0)
  // true = volume otot termasuk kontribusi otot sekunder (mis. Bench Press → Trisep 0.5, Bahu 0.3)
  const [inclSecondary, setInclSecondary] = useState(true)
  const weeks = [3, 2, 1, 0].map((w) => {
    const k = w + volPage * 4
    const start = addDays(weekStart(today), -k * 7)
    const end = addDays(start, 6)
    let vol = 0
    for (const s of sessions) {
      if (s.endedAt === null) continue
      if (s.date >= start && s.date <= end) vol += volumeOf(s.sets)
    }
    return { start, end, vol }
  })
  const maxVol = Math.max(...weeks.map((w) => w.vol), 1)
  const pageVolume = weeks.reduce((acc, w) => acc + w.vol, 0)
  const pageSessions = sessions.filter(
    (s) => s.endedAt !== null && weeks.some((w) => s.date >= w.start && s.date <= w.end),
  ).length
  const pageSets = sessions
    .filter((s) => s.endedAt !== null && weeks.some((w) => s.date >= w.start && s.date <= w.end))
    .reduce((acc, s) => acc + s.sets.length, 0)
  const pageLabel = (() => {
    const [y1, m1] = weeks[0].start.split('-')
    const [y2, m2] = weeks[3].end.split('-')
    const a = MONTHS[Number(m1) - 1]
    const b = MONTHS[Number(m2) - 1]
    if (y1 === y2) return m1 === m2 ? `${a} ${y1}` : `${a}–${b} ${y1}`
    return `${a} ${y1}–${b} ${y2}`
  })()
  const weekLabel = (start: string, end: string) =>
    start.slice(8, 10) + '/' + start.slice(5, 7) + '–' + end.slice(8, 10) + '/' + end.slice(5, 7)

  // Volume per grup otot (mengikuti halaman pager volume)
  const MUSCLE_TRACKED = ['Dada', 'Punggung', 'Kaki', 'Bahu', 'Bisep', 'Trisep', 'Forearm', 'Core']
  const muscleVol = new Map<string, number>()
  for (const m of MUSCLE_TRACKED) muscleVol.set(m, 0)
  for (const s of sessions) {
    if (s.endedAt === null) continue
    if (!weeks.some((w) => s.date >= w.start && s.date <= w.end)) continue
    for (const set of s.sets) {
      const ex = exercises.find((e) => e.id === set.exerciseId)
      if (!ex || !MUSCLE_TRACKED.includes(ex.muscleGroup)) continue
      const vol = volumeOf([set])
      muscleVol.set(ex.muscleGroup, (muscleVol.get(ex.muscleGroup) ?? 0) + vol)
      if (inclSecondary) {
        for (const f of secondaryFactorsFor(ex.name)) {
          if (!MUSCLE_TRACKED.includes(f.group)) continue
          muscleVol.set(f.group, (muscleVol.get(f.group) ?? 0) + vol * f.factor)
        }
      }
    }
  }
  const muscleList = Array.from(muscleVol.entries()).sort((a, b) => b[1] - a[1])
  const maxMuscleVol = Math.max(...muscleList.map(([, v]) => v), 1)

  // Ringkasan cardio (semua sesi)
  interface CardioInfo { dist: number; dur: number; elev: number; sesi: Set<string> }
  const cardioMap = new Map<string, CardioInfo>()
  for (const s of sessions) {
    if (s.endedAt === null) continue
    for (const set of s.sets) {
      const ex = exercises.find((e) => e.id === set.exerciseId)
      if (!ex || (ex.muscleGroup !== 'Cardio' && ex.category !== 'cardio')) continue
      const c = cardioMap.get(set.exerciseId) ?? { dist: 0, dur: 0, elev: 0, sesi: new Set<string>() }
      c.dist += set.distanceKm ?? 0
      c.dur += set.durationSec ?? 0
      c.elev += set.elevationM ?? 0
      c.sesi.add(s.id)
      cardioMap.set(set.exerciseId, c)
    }
  }
  const cardioList = Array.from(cardioMap.entries())
    .map(([exId, c]) => ({ exId, dist: c.dist, dur: c.dur, elev: c.elev, n: c.sesi.size }))
    .sort((a, b) => b.dist - a.dist)

  // Weekly best e1RM per exercise (8 minggu kalender terakhir)
  const trendWins = buildTrendWeeks(today)
  const trendMap = buildTrendMap(sessions, exercises, trendWins)
  const trends = Array.from(trendMap.entries())
    .filter(([, vals]) => vals.some((v) => v > 0))
    .map(([exId, vals]) => {
      let lastIdx = -1
      for (let i = 7; i >= 0; i--) {
        if (vals[i] > 0) { lastIdx = i; break }
      }
      let prev = 0
      for (let i = lastIdx - 1; i >= 0; i--) {
        if (vals[i] > 0) { prev = vals[i]; break }
      }
      const lastVal = lastIdx >= 0 ? vals[lastIdx] : 0
      return { exId, vals, lastVal, delta: lastVal > 0 && prev > 0 ? lastVal - prev : null }
    })
    .sort((a, b) => b.lastVal - a.lastVal)
    .slice(0, 8)

  // Tren e1RM per lift (SBD): Squat, Bench Press, Deadlift
  interface SbdRow { exId: string; vals: number[]; lastVal: number; delta: number | null; bestIdx: number }
  const sbdLifts = SBD_LIFTS.map((lift) => {
    const rows: SbdRow[] = exercises
      .filter((ex) => isSbdExercise(ex, lift.key))
      .map((ex) => {
        const vals = trendMap.get(ex.id) ?? new Array(8).fill(0)
        let lastIdx = -1
        for (let i = 7; i >= 0; i--) {
          if (vals[i] > 0) { lastIdx = i; break }
        }
        let prev = 0
        for (let i = lastIdx - 1; i >= 0; i--) {
          if (vals[i] > 0) { prev = vals[i]; break }
        }
        const lastVal = lastIdx >= 0 ? vals[lastIdx] : 0
        let bestIdx = -1
        let best = 0
        for (let i = 0; i < vals.length; i++) {
          if (vals[i] > best) { best = vals[i]; bestIdx = i }
        }
        return {
          exId: ex.id,
          vals,
          lastVal,
          delta: lastVal > 0 && prev > 0 ? lastVal - prev : null,
          bestIdx: best > 0 ? bestIdx : -1,
        }
      })
      .filter((r) => r.lastVal > 0)
    const score = rows.reduce((m, r) => Math.max(m, r.lastVal), 0)
    return { ...lift, rows, score }
  })
  const sbdTotal = sbdLifts.reduce((acc, l) => acc + l.score, 0)
  const sbdAnyData = sbdLifts.some((l) => l.score > 0)
  const sbdMissing = sbdLifts.filter((l) => l.score === 0).map((l) => l.label)

  // PR per exercise (4 dimensi: beban, reps, durasi, e1RM)
  const [prMode, setPrMode] = useState<'weight' | 'reps' | 'dur' | 'e1rm'>('weight')
  const [prMuscle, setPrMuscle] = useState('Semua')
  const [volTab, setVolTab] = useState<'muscle' | 'cardio'>('muscle')
  const [openCards, setOpenCards] = useState({ trend: false, rpe: false, pr: false, sbd: false })

  interface PrBest { weight: number; reps: number; durationSec: number; e1rm: number; date: string }
  const prMap = new Map<string, { weight?: PrBest; reps?: PrBest; dur?: PrBest; e1rm?: PrBest }>()
  for (const s of sessions) {
    if (s.endedAt === null) continue
    for (const set of s.sets) {
      const cur = prMap.get(set.exerciseId) ?? {}
      const durEx = exerciseIsDuration(exercises, set.exerciseId)
      const e1rm = set.weightKg * (1 + set.reps / 30)
      const sec = set.durationSec ?? 0
      if (set.weightKg > 0 && (!cur.weight || set.weightKg > cur.weight.weight || (set.weightKg === cur.weight.weight && (durEx ? sec : set.reps) > (durEx ? cur.weight.durationSec : cur.weight.reps)))) {
        cur.weight = { weight: set.weightKg, reps: set.reps, durationSec: sec, e1rm, date: s.date }
      }
      if (!durEx && set.reps > 0 && (!cur.reps || set.reps > cur.reps.reps || (set.reps === cur.reps.reps && set.weightKg > cur.reps.weight))) {
        cur.reps = { weight: set.weightKg, reps: set.reps, durationSec: 0, e1rm, date: s.date }
      }
      if (durEx && sec > 0 && (!cur.dur || sec > cur.dur.durationSec)) {
        cur.dur = { weight: set.weightKg, reps: 0, durationSec: sec, e1rm: 0, date: s.date }
      }
      if (!durEx && set.weightKg > 0 && (!cur.e1rm || e1rm > cur.e1rm.e1rm)) {
        cur.e1rm = { weight: set.weightKg, reps: set.reps, durationSec: 0, e1rm, date: s.date }
      }
      prMap.set(set.exerciseId, cur)
    }
  }
  const prs: [string, PrBest][] = Array.from(prMap.entries())
    .map(([exId, v]) => [exId, v[prMode]] as [string, PrBest | undefined])
    .filter(([, v]) => !!v && (prMode === 'reps' ? v.reps > 0 : prMode === 'dur' ? v.durationSec > 0 : v.weight > 0)) as [string, PrBest][]
  prs.sort((a, b) => {
    const pa = prMode === 'weight' ? a[1].weight : prMode === 'reps' ? a[1].reps : prMode === 'dur' ? a[1].durationSec : a[1].e1rm
    const pb = prMode === 'weight' ? b[1].weight : prMode === 'reps' ? b[1].reps : prMode === 'dur' ? b[1].durationSec : b[1].e1rm
    return pb - pa
  })
  const prMuscles = ['Semua', ...Array.from(new Set(Array.from(prMap.keys())
    .map((exId) => exercises.find((e) => e.id === exId)?.muscleGroup)
    .filter((g): g is string => !!g)))]
  const prsFiltered = prMuscle === 'Semua' ? prs : prs.filter(([exId]) => exercises.find((e) => e.id === exId)?.muscleGroup === prMuscle)

  // Avg RPE per exercise (from sessions with rpes)
  const rpeMap = new Map<string, { sum: number; count: number }>()
  for (const s of sessions) {
    if (s.endedAt === null) continue
    for (const [exId, rpe] of Object.entries(s.rpes ?? {})) {
      const cur = rpeMap.get(exId) ?? { sum: 0, count: 0 }
      cur.sum += rpe
      cur.count += 1
      rpeMap.set(exId, cur)
    }
  }
  const rpes = Array.from(rpeMap.entries())
    .map(([exId, v]) => ({ exId, avg: v.sum / v.count, count: v.count }))
    .sort((a, b) => b.avg - a.avg)

  // ===== Minggu ini: breakdown per grup otot =====
  const thisWeekStart = weekStart(today)
  const thisWeekEnd = addDays(thisWeekStart, 6)
  interface MuscleWeekInfo { sessions: Set<string>; sets: number; vol: number }
  const thisWeekMuscle = new Map<string, MuscleWeekInfo>()
  for (const m of MUSCLE_TRACKED) thisWeekMuscle.set(m, { sessions: new Set(), sets: 0, vol: 0 })
  for (const s of sessions) {
    if (s.endedAt === null) continue
    if (s.date < thisWeekStart || s.date > thisWeekEnd) continue
    for (const set of s.sets) {
      const ex = exercises.find((e) => e.id === set.exerciseId)
      if (!ex || !MUSCLE_TRACKED.includes(ex.muscleGroup)) continue
      const info = thisWeekMuscle.get(ex.muscleGroup)!
      info.sessions.add(s.id)
      info.sets += 1
      info.vol += volumeOf([set])
      if (inclSecondary) {
        for (const f of secondaryFactorsFor(ex.name)) {
          if (!MUSCLE_TRACKED.includes(f.group)) continue
          const sec = thisWeekMuscle.get(f.group)!
          sec.sessions.add(s.id)
          sec.sets += 1
          sec.vol += volumeOf([set]) * f.factor
        }
      }
    }
  }
  const thisWeekList = Array.from(thisWeekMuscle.entries())
    .filter(([, v]) => v.sets > 0)
    .sort((a, b) => b[1].vol - a[1].vol)
  const maxThisWeekVol = Math.max(...thisWeekList.map(([, v]) => v.vol), 1)

  return (
    <div className="page">
      <div className="page-title">Progress</div>
      <div className="subtitle">Ringkasan latihan kamu</div>

      <div className="row wrap">
        <StatCard label="Sesi selesai" value={String(pageSessions)} />
        <StatCard label="Total set" value={String(pageSets)} />
        <StatCard label="Volume total" value={fmtNumber(pageVolume) + ' kg'} />
      </div>

      {/* ===== Otot Minggu Ini ===== */}
      <div className="card">
        <div className="card-title">Otot Minggu Ini</div>
        <div className="small muted" style={{ marginBottom: 8 }}>
          {formatDMYWIB(thisWeekStart)} – {formatDMYWIB(thisWeekEnd)}
        </div>
        {thisWeekList.length === 0 ? (
          <div className="small muted">Belum ada sesi latihan minggu ini.</div>
        ) : (
          <>
          {thisWeekList.map(([m, v]) => (
            <div key={m} className="row" style={{ marginTop: 6, alignItems: 'center' }}>
              <span className="small" style={{ width: 64, fontWeight: 700 }}>{m}</span>
              <div className="bar-track grow">
                <div className="bar-fill" style={{ width: `${(v.vol / maxThisWeekVol) * 100}%` }} />
              </div>
              <div className="small muted" style={{ width: 100, textAlign: 'right' }}>
                {v.sessions.size} sesi · {v.sets} set · {fmtNumber(Math.round(v.vol))} kg
              </div>
            </div>
          ))}
          <div className="small muted" style={{ marginTop: 8 }}>
            {thisWeekList.reduce((a, [, v]) => a + v.sessions.size, 0)} sesi ·{' '}
            {thisWeekList.reduce((a, [, v]) => a + v.sets, 0)} total set ·{' '}
            {fmtNumber(Math.round(thisWeekList.reduce((a, [, v]) => a + v.vol, 0)))} kg volume
            {inclSecondary && ' · termasuk secondary'}
          </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="row spread" style={{ alignItems: 'center' }}>
          <div className="card-title">Volume per minggu (kg)</div>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <button className="btn sm ghost" onClick={() => setVolPage((p) => p + 1)}>‹</button>
            <span className="small muted">{pageLabel}</span>
            <button className="btn sm ghost" disabled={volPage === 0} onClick={() => setVolPage((p) => Math.max(0, p - 1))}>›</button>
          </div>
        </div>
        {weeks.map((w) => (
          <div key={weekLabel(w.start, w.end)} className="row" style={{ marginTop: 6 }}>
            <span className="small muted" style={{ width: 96 }}>{weekLabel(w.start, w.end)}</span>
            <div className="bar-track grow">
              <div className="bar-fill" style={{ width: `${(w.vol / maxVol) * 100}%` }} />
            </div>
            <span className="small" style={{ width: 52, textAlign: 'right' }}>{fmtNumber(w.vol)}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="row spread" style={{ alignItems: 'center', marginBottom: 8 }}>
          <div className="card-title" style={{ margin: 0 }}>Volume per grup otot (kg)</div>
          <div className="cal-toggle" style={{ margin: 0 }}>
            <button className={volTab === 'muscle' ? 'active' : ''} onClick={() => setVolTab('muscle')}>Volume otot</button>
            <button className={volTab === 'cardio' ? 'active' : ''} onClick={() => setVolTab('cardio')}>Cardio</button>
          </div>
        </div>
        {volTab === 'muscle' && (
          <div className="cal-toggle" style={{ marginBottom: 10 }}>
            <button className={!inclSecondary ? 'active' : ''} onClick={() => setInclSecondary(false)}>Primary only</button>
            <button className={inclSecondary ? 'active' : ''} onClick={() => setInclSecondary(true)}>Include secondary</button>
          </div>
        )}
        {volTab === 'muscle' ? (
        <>
        {muscleList.map(([m, v]) => (
          <div key={m} className="row" style={{ marginTop: 6 }}>
            <span className="small muted" style={{ width: 96 }}>{m}</span>
            <div className="bar-track grow">
              <div className="bar-fill" style={{ width: `${(v / maxMuscleVol) * 100}%` }} />
            </div>
            <span className="small" style={{ width: 60, textAlign: 'right' }}>{fmtNumber(v)}</span>
          </div>
        ))}
        {inclSecondary && (
          <div className="small muted" style={{ marginTop: 8 }}>
            Termasuk kontribusi otot sekunder (mis. Bench Press → Trisep 0.5, Bahu 0.3 · Squat → Punggung 0.3, Core 0.4).
          </div>
        )}
        </>
        ) : (
        <>
        {cardioList.length === 0 ? (
          <div className="small muted">Belum ada data cardio. Isi durasi & jarak (km) di sesi Cardio Day.</div>
        ) : (
          <div className="pr-list">
            {cardioList.map(({ exId, dist, dur, elev, n }) => {
              const pace = dur > 0 && dist > 0 ? paceStr(dur / 60, dist) : null
              return (
                <div className="pr" key={exId}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{getExerciseName(exercises, exId)}</div>
                    <div className="small muted">
                      {fmtNumber(dist)} km · {fmtMinutes(dur)} · {n} sesi
                      {pace && ` · ${pace}/km`}
                      {elev > 0 && ` · ↑${fmtNumber(elev)} m`}
                    </div>
                  </div>
                  <div className="val">{fmtNumber(dist)} km</div>
                </div>
              )
            })}
          </div>
        )}
        </>
        )}
      </div>

      <div className="card">
        <div
          className="card-title toggle-head"
          role="button"
          tabIndex={0}
          onClick={() => setOpenCards((o) => ({ ...o, sbd: !o.sbd }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenCards((o) => ({ ...o, sbd: !o.sbd })) }
          }}
        >
          <span>Tren e1RM per lift (SBD)</span>
          <span>{openCards.sbd ? '▾' : '▸'}</span>
        </div>
        {openCards.sbd && (
        <>
        {!sbdAnyData ? (
          <div className="small muted">Belum ada data SBD. Catat Squat, Bench Press, dan Deadlift dengan beban & reps di sesi latihan.</div>
        ) : (
          <>
          <div className="pr" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 800 }}>Total SBD</div>
              <div className="small muted">
                {sbdMissing.length > 0
                  ? 'parsial — ' + sbdMissing.join(' & ') + ' belum tercatat'
                  : 'Squat + Bench Press + Deadlift'}
              </div>
            </div>
            <div className="val">~{e1rmStr(sbdTotal)} kg</div>
          </div>
          {sbdLifts.map((lift) => (
            <div key={lift.key} style={{ marginTop: 8 }}>
              <div className="small muted" style={{ fontWeight: 800, letterSpacing: 1, marginBottom: 4 }}>
                {lift.label.toUpperCase()}
              </div>
              {lift.rows.length === 0 ? (
                <div className="small muted">Belum ada gerakan {lift.label} — tambahkan di tab Gerakan.</div>
              ) : (
                lift.rows.map((t) => {
                  const max = Math.max(...t.vals, 1)
                  return (
                    <div className="pr trend" key={t.exId}>
                      <div style={{ flex: 1 }}>
                        <div className="trend-val">
                          <span style={{ fontWeight: 700 }}>{getExerciseName(exercises, t.exId)}</span>
                          <span>
                            <span className="val" style={{ fontSize: 14 }}>~{e1rmStr(t.lastVal)} kg</span>
                            {t.delta !== null && (
                              <span className={'delta ' + (t.delta > 0 ? 'up' : t.delta < 0 ? 'down' : 'flat')}>
                                {' '}{t.delta > 0 ? '▲ +' + e1rmStr(t.delta) : t.delta < 0 ? '▼ −' + e1rmStr(-t.delta) : '• 0'}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="trend-bars">
                          {t.vals.map((v, i) => (
                            <div
                              key={i}
                              className={'trend-bar' + (i === 7 ? ' now' : '') + (i === t.bestIdx ? ' pr' : '')}
                              style={{ height: Math.max(3, (v / max) * 100) + '%' }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          ))}
          </>
        )}
        </>
        )}
      </div>

      <div className="card">
        <div
          className="card-title toggle-head"
          role="button"
          tabIndex={0}
          onClick={() => setOpenCards((o) => ({ ...o, trend: !o.trend }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenCards((o) => ({ ...o, trend: !o.trend })) }
          }}
        >
          <span>Tren e1RM per gerakan (mingguan)</span>
          <span>{openCards.trend ? '▾' : '▸'}</span>
        </div>
        {openCards.trend && (
        <>
        {trends.length === 0 ? (
          <div className="small muted">Belum ada data. Isi beban & reps di sesi latihan untuk melihat tren.</div>
        ) : (
          <div className="pr-list">
            {trends.map((t) => {
              const max = Math.max(...t.vals, 1)
              return (
                <div className="pr trend" key={t.exId}>
                  <div style={{ flex: 1 }}>
                    <div className="trend-val">
                      <span style={{ fontWeight: 700 }}>{getExerciseName(exercises, t.exId)}</span>
                      <span>
                        <span className="val" style={{ fontSize: 14 }}>{t.lastVal > 0 ? '~' + e1rmStr(t.lastVal) + ' kg' : '—'}</span>
                        {t.delta !== null && (
                          <span className={'delta ' + (t.delta > 0 ? 'up' : t.delta < 0 ? 'down' : 'flat')}>
                            {' '}{t.delta > 0 ? '▲ +' + e1rmStr(t.delta) : t.delta < 0 ? '▼ −' + e1rmStr(-t.delta) : '• 0'}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="trend-bars">
                      {t.vals.map((v, i) => (
                        <div key={i} className={'trend-bar' + (i === 7 ? ' now' : '')} style={{ height: Math.max(3, (v / max) * 100) + '%' }} />
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        </>
        )}
      </div>

      <div className="card">
        <div
          className="card-title toggle-head"
          role="button"
          tabIndex={0}
          onClick={() => setOpenCards((o) => ({ ...o, pr: !o.pr }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenCards((o) => ({ ...o, pr: !o.pr })) }
          }}
        >
          <span>PR terbaik</span>
          <span>{openCards.pr ? '▾' : '▸'}</span>
        </div>
        {openCards.pr && (
        <>
        <div className="cal-toggle">
          <button className={prMode === 'weight' ? 'active' : ''} onClick={() => setPrMode('weight')}>Beban</button>
          <button className={prMode === 'reps' ? 'active' : ''} onClick={() => setPrMode('reps')}>Reps</button>
          <button className={prMode === 'dur' ? 'active' : ''} onClick={() => setPrMode('dur')}>Durasi</button>
          <button className={prMode === 'e1rm' ? 'active' : ''} onClick={() => setPrMode('e1rm')}>e1RM</button>
        </div>
        {prMuscles.length > 1 && (
          <select className="input" style={{ marginBottom: 10 }} value={prMuscle} onChange={(e) => setPrMuscle(e.target.value)}>
            {prMuscles.map((g) => (
              <option key={g} value={g}>{g === 'Semua' ? 'Semua grup otot' : g}</option>
            ))}
          </select>
        )}
        {prsFiltered.length === 0 ? (
          <div className="small muted">{prMuscle !== 'Semua' ? `Belum ada PR untuk ${prMuscle} di mode ini.` : 'Belum ada data set dengan beban. Isi beban di sesi latihan.'}</div>
        ) : (
          <div className="pr-list">
            {prsFiltered.map(([exId, pr]) => {
              const durEx = exerciseIsDuration(exercises, exId)
              return (
                <div className="pr" key={exId}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{getExerciseName(exercises, exId)}</div>
                    <div className="small muted">
                      {pr.date.slice(8, 10)}/{pr.date.slice(5, 7)}/{pr.date.slice(0, 4)} ·{' '}
                      {prMode === 'weight'
                        ? (durEx ? pr.durationSec + ' dtk' : pr.reps + ' rep')
                        : prMode === 'reps' || prMode === 'dur'
                          ? (pr.weight > 0 ? fmtNumber(pr.weight) + ' kg' : '')
                          : fmtNumber(pr.weight) + ' kg × ' + pr.reps + ' rep'}
                    </div>
                  </div>
                  <div className="val">
                    {prMode === 'weight' ? fmtNumber(pr.weight) + ' kg'
                      : prMode === 'reps' ? pr.reps + ' rep'
                      : prMode === 'dur' ? pr.durationSec + ' dtk'
                      : '~' + e1rmKg(pr.weight, pr.reps) + ' kg e1RM'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        </>
        )}
      </div>

      <div className="card">
        <div
          className="card-title toggle-head"
          role="button"
          tabIndex={0}
          onClick={() => setOpenCards((o) => ({ ...o, rpe: !o.rpe }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenCards((o) => ({ ...o, rpe: !o.rpe })) }
          }}
        >
          <span>RPE rata-rata per gerakan</span>
          <span>{openCards.rpe ? '▾' : '▸'}</span>
        </div>
        {openCards.rpe && (
        <>
        {rpes.length === 0 ? (
          <div className="small muted">Belum ada data RPE. Atur RPE (6–10) di akhir tiap gerakan saat sesi.</div>
        ) : (
          <div className="pr-list">
            {rpes.map(({ exId, avg, count }) => (
              <div className="pr" key={exId}>
                <div>
                  <div style={{ fontWeight: 700 }}>{getExerciseName(exercises, exId)}</div>
                  <div className="small muted">{count} sesi</div>
                </div>
                <div className="val">{avg.toFixed(1)}</div>
              </div>
            ))}
          </div>        )}
        </>
        )}
      </div>

      {/* ===== 5/3/1 Progress ===== */}
      <div className="card">
        <div className="card-title">5/3/1 Progress</div>
        {(() => {
          const excluded = computeExcludedTypes(settings)
          const pos = computePosition(sessions, excluded, settings.skippedSessions ?? 0)
          const seq = get531Sequence(excluded)
          const pct = Math.round((pos.sessionIndex / pos.cycleLength) * 100)
          return (
            <>
              <div className="small" style={{ marginBottom: 4 }}>
                Cycle {pos.cycle} · Sesi {pos.sessionIndex + 1}/{pos.cycleLength}
              </div>
              <div className="bar-track" style={{ marginBottom: 10 }}>
                <div className="bar-fill" style={{ width: pct + '%' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                {seq.map((s, i) => {
                  const done = i < pos.sessionIndex
                  const current = i === pos.sessionIndex
                  const typeColors: Record<string, string> = { leg: '#44cc88', push: '#6699ff', pull: '#aa77ff', easy: '#7ee787' }
                  return (
                    <div key={i} style={{
                      padding: '4px 6px', borderRadius: 6, fontSize: 11, fontWeight: current ? 800 : 400,
                      background: current ? 'rgba(99,102,241,0.15)' : done ? 'rgba(255,255,255,0.05)' : 'transparent',
                      border: current ? '1px solid var(--accent)' : '1px solid transparent',
                      opacity: done ? 0.5 : 1,
                    }}>
                      <div style={{ color: typeColors[s.key] ?? 'var(--muted)', fontSize: 10, fontWeight: 700 }}>
                        S{String(i + 1).padStart(2, '0')}
                      </div>
                      <div style={{ fontSize: 10 }}>{s.scheme || s.key}</div>
                    </div>
                  )
                })}
              </div>
            </>
          )
        })()}
      </div>
    </div>
  )
}




function buildTrendWeeks(today: string): { start: string; end: string }[] {
  return [7, 6, 5, 4, 3, 2, 1, 0].map((w) => {
    const start = addDays(weekStart(today), -w * 7)
    const end = addDays(start, 6)
    return { start, end }
  })
}

function buildTrendMap(
  sessions: Session[],
  exercises: Exercise[],
  weeks: { start: string; end: string }[],
): Map<string, number[]> {
  const map = new Map<string, number[]>()
  for (const s of sessions) {
    if (s.endedAt === null) continue
    const winIdx = weeks.findIndex((win) => s.date >= win.start && s.date <= win.end)
    if (winIdx < 0) continue
    for (const set of s.sets) {
      if (set.weightKg > 0 && !exerciseIsDuration(exercises, set.exerciseId)) {
        const e = e1rm(set.weightKg, set.reps)
        const arr = map.get(set.exerciseId) ?? new Array(weeks.length).fill(0)
        if (e > arr[winIdx]) arr[winIdx] = e
        map.set(set.exerciseId, arr)
      }
    }
  }
  return map
}


function fmtMinutes(sec: number): string {
  const m = Math.round(sec / 60)
  return m >= 60 ? Math.floor(m / 60) + ' j ' + (m % 60) + ' mnt' : m + ' mnt'
}

function paceStr(minutes: number, km: number): string {
  const p = minutes / km
  const m = Math.floor(p)
  const s = Math.round((p - m) * 60)
  return m + ':' + (s < 10 ? '0' + s : s)
}