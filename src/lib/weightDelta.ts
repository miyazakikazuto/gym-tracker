import { addDays } from './date'
import type { Bodyweight } from '../types'

// Selisih berat terakhir vs entri terdekat ≤ N hari lalu (null jika belum cukup data)
// Anchor ke tanggal entri terbaru (latest), bukan ke today, agar intuitif saat data jarang/sparse
// dan entri terbaru bukan today. Sorted asc diasumsikan; slice(0,-1) cegah pick diri sendiri.
export function deltaKg(entries: Bodyweight[], daysAgo: number): number | null {
  if (entries.length < 2) return null
  const latest = entries[entries.length - 1]
  const target = addDays(latest.date, -daysAgo)
  const prev = [...entries].slice(0, -1).reverse().find((b) => b.date <= target)
  if (!prev) return null
  return Math.round((latest.kg - prev.kg) * 100) / 100
}
