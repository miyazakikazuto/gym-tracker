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

  // PR per exercise
  const prMap = new Map<string, { weight: number; reps: number; date: string }>()
  for (const s of sessions) {
    for (const set of s.sets) {
      const cur = prMap.get(set.exerciseId)
      if (!cur || set.weightKg > cur.weight || (set.weightKg === cur.weight && set.reps > cur.reps)) {
        prMap.set(set.exerciseId, { weight: set.weightKg, reps: set.reps, date: s.date })
      }
    }
  }
  const prs = Array.from(prMap.entries())
    .filter(([, v]) => v.weight > 0)
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, 8)

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
        <div className="card-title">PR terbaik (beban tertinggi)</div>
        {prs.length === 0 ? (
          <div className="small muted">Belum ada data set dengan beban. Isi beban di sesi latihan.</div>
        ) : (
          <div className="pr-list">
            {prs.map(([exId, pr]) => (
              <div className="pr" key={exId}>
                <div>
                  <div style={{ fontWeight: 700 }}>{getExerciseName(exercises, exId)}</div>
                  <div className="small muted">{pr.date.slice(8, 10)}/{pr.date.slice(5, 7)}/{pr.date.slice(0, 4)} · {pr.reps} rep</div>
                </div>
                <div className="val">{fmtNumber(pr.weight)} kg</div>
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