// Tren e1RM mingguan (blok Senin–Minggu) + set asal yang menghasilkan nilainya.
// Set asal disimpan supaya angka estimasi bisa diaudit ke data nyata di UI.
import { addDays, mondayOf } from './date'
import { e1rm } from './e1rm'
import { exerciseIsDuration } from './helpers'
import type { Exercise, Session } from '../types'

export interface TrendPoint {
  e1rm: number
  weightKg: number
  reps: number
  date: string
}

/** 8 blok minggu terakhir, terlama → terbaru. */
export function buildTrendWeeks(today: string): { start: string; end: string }[] {
  return [7, 6, 5, 4, 3, 2, 1, 0].map((w) => {
    const start = addDays(mondayOf(today), -w * 7)
    const end = addDays(start, 6)
    return { start, end }
  })
}

/**
 * e1RM terbaik per gerakan per minggu. Set dengan reps di luar rentang valid
 * Epley (lihat `e1rm`) dilewati, jadi tidak bisa menggelembungkan bar.
 */
export function buildTrendMap(
  sessions: Session[],
  exercises: Exercise[],
  weeks: { start: string; end: string }[],
): Map<string, (TrendPoint | null)[]> {
  const map = new Map<string, (TrendPoint | null)[]>()
  for (const s of sessions) {
    if (s.endedAt === null) continue
    const winIdx = weeks.findIndex((win) => s.date >= win.start && s.date <= win.end)
    if (winIdx < 0) continue
    for (const set of s.sets) {
      if (set.weightKg <= 0 || exerciseIsDuration(exercises, set.exerciseId)) continue
      const e = e1rm(set.weightKg, set.reps)
      // reps di luar rentang valid Epley → tidak layak jadi titik tren
      if (e <= 0) continue
      const arr = map.get(set.exerciseId) ?? new Array<TrendPoint | null>(weeks.length).fill(null)
      const cur = arr[winIdx]
      if (cur === null || e > cur.e1rm) {
        arr[winIdx] = { e1rm: e, weightKg: set.weightKg, reps: set.reps, date: s.date }
      }
      map.set(set.exerciseId, arr)
    }
  }
  return map
}
