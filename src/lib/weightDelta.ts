import { addDays } from './date'
import type { Bodyweight } from '../types'

// Selisih berat terakhir vs entri terdekat ≤ N hari sebelum HARI INI (today).
// "Δ N hari" = perubahan dalam N hari kalender terakhir, jadi acuan wajib today —
// bukan tanggal entry terakhir. Bila anchor ke latest.date, entry terbaru yang
// bukan hari ini menggeser jendela (mis. terakhir 28/08 & hari ini 31/08 → Δ30
// mundur ke 29/07 dan bisa jadi '—' padahal data akhir Juli masih ada).
// null bila belum cukup riwayat. Entries diasumsikan ascending; slice(0,-1) cegah
// pick diri sendiri; prev = entri terdekat yang ≤ target (bukan yang persis N hari).
export function deltaKg(entries: Bodyweight[], daysAgo: number, today: string): number | null {
  if (entries.length < 2) return null
  const latest = entries[entries.length - 1]
  const target = addDays(today, -daysAgo)
  const prev = [...entries].slice(0, -1).reverse().find((b) => b.date <= target)
  if (!prev) return null
  return Math.round((latest.kg - prev.kg) * 100) / 100
}
