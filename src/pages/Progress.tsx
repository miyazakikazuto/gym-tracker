import { useState } from 'react'
import { useData } from '../context/DataContext'
import { volumeOf, todayKey, addDays, weekStart } from '../lib/date'
import { fmtNumber, getExerciseName, exerciseIsDuration } from '../lib/helpers'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export default function Progress() {
  const { sessions, exercises } = useData()

  const today = todayKey()
  const [volPage, setVolPage] = useState(0)
  const weeks = [3, 2, 1, 0].map((w) => {
    const k = w + volPage * 4
    const start = addDays(weekStart(today), -k * 7)
    const end = addDays(start, 6)
    let vol = 0
    for (const s of sessions) {
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
    .filter((s) => weeks.some((w) => s.date >= w.start && s.date <= w.end))
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
  const MUSCLE_TRACKED = ['Dada', 'Punggung', 'Kaki', 'Bahu', 'Bisep', 'Forearm']
  const muscleVol = new Map<string, number>()
  for (const m of MUSCLE_TRACKED) muscleVol.set(m, 0)
  for (const s of sessions) {
    if (!weeks.some((w) => s.date >= w.start && s.date <= w.end)) continue
    for (const set of s.sets) {
      const ex = exercises.find((e) => e.id === set.exerciseId)
      if (!ex || !MUSCLE_TRACKED.includes(ex.muscleGroup)) continue
      muscleVol.set(ex.muscleGroup, (muscleVol.get(ex.muscleGroup) ?? 0) + volumeOf([set]))
    }
  }
  const muscleList = Array.from(muscleVol.entries()).sort((a, b) => b[1] - a[1])
  const maxMuscleVol = Math.max(...muscleList.map(([, v]) => v), 1)

  // Ringkasan cardio (semua sesi)
  const cardioMap = new Map<string, { dist: number; dur: number; sesi: Set<string> }>()
  for (const s of sessions) {
    for (const set of s.sets) {
      const ex = exercises.find((e) => e.id === set.exerciseId)
      if (!ex || ex.muscleGroup !== 'Cardio') continue
      const c = cardioMap.get(set.exerciseId) ?? { dist: 0, dur: 0, sesi: new Set<string>() }
      c.dist += set.distanceKm ?? 0
      c.dur += set.durationSec ?? 0
      c.sesi.add(s.id)
      cardioMap.set(set.exerciseId, c)
    }
  }
  const cardioList = Array.from(cardioMap.entries())
    .map(([exId, c]) => ({ exId, dist: c.dist, dur: c.dur, n: c.sesi.size }))
    .sort((a, b) => b.dist - a.dist)

  // Weekly best e1RM per exercise (8 minggu kalender terakhir)
  const trendWins = [7, 6, 5, 4, 3, 2, 1, 0].map((w) => {
    const start = addDays(weekStart(today), -w * 7)
    const end = addDays(start, 6)
    return { start, end }
  })
  const trendMap = new Map<string, number[]>()
  for (const s of sessions) {
    const winIdx = trendWins.findIndex((win) => s.date >= win.start && s.date <= win.end)
    if (winIdx < 0) continue
    for (const set of s.sets) {
      if (set.weightKg > 0 && !exerciseIsDuration(exercises, set.exerciseId)) {
        const e = e1rmNum(set.weightKg, set.reps)
        const arr = trendMap.get(set.exerciseId) ?? new Array(8).fill(0)
        if (e > arr[winIdx]) arr[winIdx] = e
        trendMap.set(set.exerciseId, arr)
      }
    }
  }
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

  // PR per exercise (4 dimensi: beban, reps, durasi, e1RM)
  const [prMode, setPrMode] = useState<'weight' | 'reps' | 'dur' | 'e1rm'>('weight')
  const [prMuscle, setPrMuscle] = useState('Semua')
  const [volTab, setVolTab] = useState<'muscle' | 'cardio'>('muscle')
  const [openCards, setOpenCards] = useState({ trend: false, rpe: false, pr: false })
  interface PrBest { weight: number; reps: number; durationSec: number; e1rm: number; date: string }
  const prMap = new Map<string, { weight?: PrBest; reps?: PrBest; dur?: PrBest; e1rm?: PrBest }>()
  for (const s of sessions) {
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

  return (
    <div className="page">
      <div className="page-title">Progress</div>
      <div className="subtitle">Ringkasan latihan kamu</div>

      <div className="row wrap">
        <StatCard label="Sesi selesai" value={String(pageSessions)} />
        <StatCard label="Total set" value={String(pageSets)} />
        <StatCard label="Volume total" value={fmtNumber(pageVolume) + ' kg'} />
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
        </>
        ) : (
        <>
        {cardioList.length === 0 ? (
          <div className="small muted">Belum ada data cardio. Isi durasi & jarak (km) di sesi Cardio Day.</div>
        ) : (
          <div className="pr-list">
            {cardioList.map(({ exId, dist, dur, n }) => {
              const pace = dur > 0 && dist > 0 ? paceStr(dur / 60, dist) : null
              return (
                <div className="pr" key={exId}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{getExerciseName(exercises, exId)}</div>
                    <div className="small muted">
                      {fmtNumber(dist)} km · {fmtMinutes(dur)} · {n} sesi{pace && ` · pace ${pace}/km`}
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
        <div className="card-title toggle-head" onClick={() => setOpenCards((o) => ({ ...o, pr: !o.pr }))}>
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
                      : '~' + e1RmKg(pr.weight, pr.reps) + ' kg e1RM'}
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
        <div className="card-title toggle-head" onClick={() => setOpenCards((o) => ({ ...o, trend: !o.trend }))}>
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
                        <span className="val" style={{ fontSize: 14 }}>{t.lastVal > 0 ? '~' + e1RmStr(t.lastVal) + ' kg' : '—'}</span>
                        {t.delta !== null && (
                          <span className={'delta ' + (t.delta > 0 ? 'up' : t.delta < 0 ? 'down' : 'flat')}>
                            {' '}{t.delta > 0 ? '▲ +' + e1RmStr(t.delta) : t.delta < 0 ? '▼ −' + e1RmStr(-t.delta) : '• 0'}
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
        <div className="card-title toggle-head" onClick={() => setOpenCards((o) => ({ ...o, rpe: !o.rpe }))}>
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
          </div>
        )}
        </>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card stat" style={{ flex: 1, minWidth: 100, textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 900 }}>{value}</div>
      <div className="small muted">{label}</div>
    </div>
  )
}

function e1rmNum(weight: number, reps: number): number {
  return weight * (1 + reps / 30)
}

function e1RmStr(val: number): string {
  const r = Math.round(val * 2) / 2
  return r % 1 === 0 ? String(Math.round(r)) : r.toFixed(1)
}

function e1RmKg(weight: number, reps: number): string {
  return e1RmStr(e1rmNum(weight, reps))
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