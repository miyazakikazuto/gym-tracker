import { addDays } from './date'
import type { Bodyweight } from '../types'

// Selisih berat terakhir vs entri terlama dalam jendela N hari terakhir.
// "Δ N hari" = perubahan dari entri tertua di jendela [today-N, today] ke latest.
// Anchor ke today (bukan latest.date) supaya Δ selalu relevan dengan hari ini.
// Contoh: today=31/08, Δ7 → jendela [24/08–31/08], pakai entry Aug 25 (53.4)
//          bukan Aug 24 (52.9) yang lebih tua dari jendela.
// null bila <2 entry atau tidak ada entry di jendela.
export function deltaKg(entries: Bodyweight[], daysAgo: number, today: string): number | null {
  if (entries.length < 2) return null
  const latest = entries[entries.length - 1]
  const windowStart = addDays(today, -daysAgo)
  // Cari entry terlama (pertama ascending) yang masih dalam jendela (windowStart, today]
  // Exclude latest sendiri (slice(0, -1)). Pakai > bukan >= supaya entry tepat
  // di batas window (persis N hari lalu) tidak dipakai — user期望 entry yang
  // benar-benar masih dalam N hari terakhir, bukan yang tepat di batas.
  const prev = entries.slice(0, -1).find((b) => b.date > windowStart)
  if (!prev) return null
  return Math.round((latest.kg - prev.kg) * 100) / 100
}
