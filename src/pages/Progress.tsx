import { useState } from 'react'
import { useData } from '../context/DataContext'
import { volumeOf, todayKey, addDays } from '../lib/date'
import { fmtNumber, getExerciseName } from '../lib/helpers'

export default function Progress() {
  const { sessions, exercises } = useData()

  const totalSessions = sessions.filter((s) => s.endedAt).length
  const totalSets = sessions.reduce((acc, s) => acc + s.sets.length, 0)
  const totalVolume = sessions.reduce((acc, s) => acc + volumeOf(s.sets), 0)

  // Last 4 weeks volume
  const today = todayKey()
  const weeks = [3, 2, 1, 0].map((w) => {
    const start = addDays(today, -(w * 7 + 6))
    const end = addDays(today, -w * 7)
    let vol = 0
    for (const s of sessions) {
      if (s.date >= start && s.date <= end) vol += volumeOf(s.sets)
    }
    return { label: start.slice(5, 7) + '/' + start.slice(8, 10) + '–' + end.slice(8, 10), vol }
  })
  const maxVol = Math.max(...weeks.map((w) => w.vol), 1)

  // Weekly best e1RM per exercise (8 minggu terakhir)
  const trendWins = [7, 6, 5, 4, 3, 2, 1, 0].map((w) => {
    const start = addDays(today, -(w * 7 + 6))
    const end = addDays(today, -w * 7)
    return { start, end }
  })
  const trendMap = new Map<string, number[]>()
  for (const s of sessions) {
    const winIdx = trendWins.findIndex((win) => s.date >= win.start && s.date <= win.end)
    if (winIdx < 0) continue
    for (const set of s.sets) {
      if (set.weightKg > 0) {
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

  // PR per exercise (3 dimensi: beban, reps, e1RM)
  const [prMode, setPrMode] = useState<'weight' | 'reps' | 'e1rm'>('weight')
  interface PrBest { weight: number; reps: number; e1rm: number; date: string }
  const prMap = new Map<string, { weight?: PrBest; reps?: PrBest; e1rm?: PrBest }>()
  for (const s of sessions) {
    for (const set of s.sets) {
      const cur = prMap.get(set.exerciseId) ?? {}
      const e1rm = set.weightKg * (1 + set.reps / 30)
      if (set.weightKg > 0 && (!cur.weight || set.weightKg > cur.weight.weight || (set.weightKg === cur.weight.weight && set.reps > cur.weight.reps))) {
        cur.weight = { weight: set.weightKg, reps: set.reps, e1rm, date: s.date }
      }
      if (set.reps > 0 && (!cur.reps || set.reps > cur.reps.reps || (set.reps === cur.reps.reps && set.weightKg > cur.reps.weight))) {
        cur.reps = { weight: set.weightKg, reps: set.reps, e1rm, date: s.date }
      }
      if (set.weightKg > 0 && (!cur.e1rm || e1rm > cur.e1rm.e1rm)) {
        cur.e1rm = { weight: set.weightKg, reps: set.reps, e1rm, date: s.date }
      }
      prMap.set(set.exerciseId, cur)
    }
  }
  const prs: [string, PrBest][] = Array.from(prMap.entries())
    .map(([exId, v]) => [exId, v[prMode]] as [string, PrBest | undefined])
    .filter(([, v]) => !!v && v.weight > 0) as [string, PrBest][]
  prs.sort((a, b) => {
    const pa = prMode === 'weight' ? a[1].weight : prMode === 'reps' ? a[1].reps : a[1].e1rm
    const pb = prMode === 'weight' ? b[1].weight : prMode === 'reps' ? b[1].reps : b[1].e1rm
    return pb - pa
  })
  prs.length = Math.min(prs.length, 8)

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
        <StatCard label="Sesi selesai" value={String(totalSessions)} />
        <StatCard label="Total set" value={String(totalSets)} />
        <StatCard label="Volume total" value={fmtNumber(totalVolume) + ' kg'} />
      </div>

      <div className="card">
        <div className="card-title">Volume per minggu (kg)</div>
        {weeks.map((w) => (
          <div key={w.label} className="row" style={{ marginTop: 6 }}>
            <span className="small muted" style={{ width: 96 }}>{w.label}</span>
            <div className="bar-track grow">
              <div className="bar-fill" style={{ width: `${(w.vol / maxVol) * 100}%` }} />
            </div>
            <span className="small" style={{ width: 52, textAlign: 'right' }}>{fmtNumber(w.vol)}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Tren e1RM per gerakan (mingguan)</div>
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
      </div>

      <div className="card">
        <div className="card-title">RPE rata-rata per gerakan</div>
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
      </div>

      <div className="card">
        <div className="card-title">PR terbaik</div>
        <div className="cal-toggle">
          <button className={prMode === 'weight' ? 'active' : ''} onClick={() => setPrMode('weight')}>Beban</button>
          <button className={prMode === 'reps' ? 'active' : ''} onClick={() => setPrMode('reps')}>Reps</button>
          <button className={prMode === 'e1rm' ? 'active' : ''} onClick={() => setPrMode('e1rm')}>e1RM</button>
        </div>
        {prs.length === 0 ? (
          <div className="small muted">Belum ada data set dengan beban. Isi beban di sesi latihan.</div>
        ) : (
          <div className="pr-list">
            {prs.map(([exId, pr]) => (
              <div className="pr" key={exId}>
                <div>
                  <div style={{ fontWeight: 700 }}>{getExerciseName(exercises, exId)}</div>
                  <div className="small muted">
                    {pr.date.slice(8, 10)}/{pr.date.slice(5, 7)}/{pr.date.slice(0, 4)} ·{' '}
                    {prMode === 'weight' ? pr.reps + ' rep' : prMode === 'reps' ? fmtNumber(pr.weight) + ' kg' : fmtNumber(pr.weight) + ' kg × ' + pr.reps + ' rep'}
                  </div>
                </div>
                <div className="val">
                  {prMode === 'weight' ? fmtNumber(pr.weight) + ' kg' : prMode === 'reps' ? pr.reps + ' rep' : '~' + e1RmKg(pr.weight, pr.reps) + ' kg e1RM'}
                </div>
              </div>
            ))}
          </div>
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