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

function e1RmKg(weight: number, reps: number): string {
  const raw = weight * (1 + reps / 30)
  const r = Math.round(raw * 2) / 2
  return r % 1 === 0 ? String(Math.round(r)) : r.toFixed(1)
}