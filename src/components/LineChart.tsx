import { fmtNumber } from '../lib/helpers'
import type { Bodyweight } from '../types'

export default function LineChart({ data, target }: { data: Bodyweight[]; target: number | null }) {
  if (data.length < 2) {
    return <div className="small muted">Butuh minimal 2 penimbangan untuk menampilkan grafik.</div>
  }
  const W = 300
  const H = 90
  const PAD = 8
  const kgs = data.map((b) => b.kg)
  const lo = Math.min(...kgs, target ?? Infinity)
  const hi = Math.max(...kgs, target ?? -Infinity)
  const span = hi - lo || 1
  const x = (i: number) => (i / (data.length - 1)) * (W - PAD * 2) + PAD
  const y = (kg: number) => H - PAD - ((kg - lo) / span) * (H - PAD * 2)
  const pts = data.map((b, i) => `${x(i).toFixed(1)},${y(b.kg).toFixed(1)}`).join(' ')
  const minK = Math.min(...kgs)
  const maxK = Math.max(...kgs)
  const minIdx = kgs.indexOf(minK)
  const maxIdx = kgs.indexOf(maxK)
  const last = data[data.length - 1]
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label="Grafik tren berat badan"
    >
      {target != null && (
        <line x1={PAD} x2={W - PAD} y1={y(target)} y2={y(target)} stroke="var(--accent)" strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
      )}
      <polyline points={pts} fill="none" stroke="var(--accent-2)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((b, i) => (
        <circle
          key={b.id}
          cx={x(i)}
          cy={y(b.kg)}
          r={i === data.length - 1 ? 3.2 : 2}
          fill={i === minIdx || i === maxIdx ? '#fbbf24' : 'var(--accent)'}
        />
      ))}
      <text x={PAD} y={H - 2} fontSize={8} fill="var(--muted)">{fmtNumber(lo)}</text>
      <text x={W - PAD} y={H - 2} fontSize={8} fill="var(--muted)" textAnchor="end">{fmtNumber(hi)}</text>
      <text x={W - PAD} y={10} fontSize={8} fill="var(--muted)" textAnchor="end">{fmtNumber(last.kg)} kg terakhir</text>
    </svg>
  )
}
