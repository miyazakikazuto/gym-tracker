import { volumeOf } from '../lib/date'
import { fmtNumber } from '../lib/helpers'
import type { Session } from '../types'

export default function SessionRow({ s, onOpen }: { s: Session; onOpen: () => void }) {
  const vol = volumeOf(s.sets)
  const topKg = s.sets.reduce((m, x) => Math.max(m, x.weightKg), 0)
  const km = s.sets.reduce((m, x) => m + (x.distanceKm ?? 0), 0)
  const name = s.planName || 'Sesi bebas'
  return (
    <div className="card" onClick={onOpen} style={{ cursor: 'pointer' }}>
      <div className="row spread">
        <b>{name}</b>
        <span className="small muted">{s.cycleLabel ?? ''} {s.date.slice(8, 10)}/{s.date.slice(5, 7)}/{s.date.slice(0, 4)}</span>
      </div>
      <div className="row" style={{ marginTop: 8, gap: 6 }}>
        <span className="badge">{s.sets.length} set</span>
        <span className="badge">{fmtNumber(vol)} kg volume</span>
        {topKg > 0 && <span className="badge accent">Top {fmtNumber(topKg)} kg</span>}
        {km > 0 && <span className="badge accent">{fmtNumber(km)} km</span>}
        {s.note && <span className="small muted">“{s.note.length > 40 ? s.note.slice(0, 40) + '…' : s.note}”</span>}
      </div>
    </div>
  )
}
