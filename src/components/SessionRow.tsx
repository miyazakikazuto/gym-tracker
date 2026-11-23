import { useData } from '../context/DataContext'
import { volumeOf } from '../lib/date'
import { fmtNumber } from '../lib/helpers'
import { autoIntensityOf } from '../lib/autoreg'
import type { Session } from '../types'

export default function SessionRow({ s, onOpen }: { s: Session; onOpen: () => void }) {
  const { settings } = useData()
  // Label siklus 5/3/1 ("[C6-S12] Upper — Deload") cuma tampil bila mode
  // 5/3/1 aktif — di mode autoregulasi disembunyikan, sama seperti di
  // halaman sesi.
  const tm = settings.trainingMax
  const is531Active =
    settings.autoRegMode !== true &&
    settings.rehabMode !== true &&
    !!(tm && (tm.squat > 0 || tm.bench > 0 || tm.deadlift > 0))
  const vol = volumeOf(s.sets)
  const topKg = s.sets.reduce((m, x) => Math.max(m, x.weightKg), 0)
  const km = s.sets.reduce((m, x) => m + (x.distanceKm ?? 0), 0)
  const name = s.planName || 'Sesi bebas'
  return (
    <div className="card" onClick={onOpen} style={{ cursor: 'pointer' }}>
      <div className="row spread">
        <b>{name}</b>
        <span className="small muted">{is531Active && s.cycleLabel ? `${s.cycleLabel} ` : ''}{s.date.slice(8, 10)}/{s.date.slice(5, 7)}/{s.date.slice(0, 4)}</span>
      </div>
      <div className="row" style={{ marginTop: 8, gap: 6 }}>
        {s.isExtra && <span className="badge warn">Extra</span>}
        {s.intensity && <span className="badge accent">{autoIntensityOf(s.intensity).label}</span>}
        <span className="badge">{s.sets.length} set</span>
        <span className="badge">{fmtNumber(vol)} kg volume</span>
        {topKg > 0 && <span className="badge accent">Top {fmtNumber(topKg)} kg</span>}
        {km > 0 && <span className="badge accent">{fmtNumber(km)} km</span>}
        {s.note && <span className="small muted">“{s.note.length > 40 ? s.note.slice(0, 40) + '…' : s.note}”</span>}
      </div>
    </div>
  )
}
