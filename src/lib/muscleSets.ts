import type { Exercise, Session } from '../types'
import { addDays, mondayOf, MONTHS } from './date'
import { secondaryFactorsFor } from './muscles'

// Target set per otot per minggu — patokan minimum efektif s.d. solid buat
// lifter awal dengan frekuensi ~1x/otot/minggu (rotasi 3 hari).
// Sengaja BUKAN 10–20 ala textbook: angka itu mengasumsikan frekuensi 2x +
// recovery penuh, sementara data nyata (Nov 2026) menunjukkan sebagian besar
// otot Miya di 0,5–6 set langsung/minggu. Kalau frekuensi naik, naikkan ini.
export const SET_TARGET_MIN = 6
export const SET_TARGET_MAX = 12
export const SET_TARGET_WEEKS = 4

export const MUSCLE_SET_TRACKED = ['Dada', 'Punggung', 'Kaki', 'Bahu', 'Bisep', 'Trisep', 'Forearm', 'Core']

export type SetTargetStatus = 'kurang' | 'pas' | 'lebih'

export function setTargetStatus(avgSetsPerWeek: number): SetTargetStatus {
  if (avgSetsPerWeek < SET_TARGET_MIN) return 'kurang'
  if (avgSetsPerWeek > SET_TARGET_MAX) return 'lebih'
  return 'pas'
}

export interface MuscleSetRow {
  muscle: string
  /** Rata-rata set/minggu selama jendela (set sekunder dihitung pecahan). */
  avgPerWeek: number
  /** Set minggu berjalan (Senin–Minggu ini). */
  thisWeek: number
}

function fmtDay(key: string): string {
  const [, m, d] = key.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`
}

/**
 * Rata-rata set per otot per minggu selama `numWeeks` minggu kalender
 * terakhir (termasuk minggu berjalan), plus set minggu berjalan.
 * Hanya sesi selesai (endedAt !== null). Set primer = 1; set sekunder
 * dihitung pecahan sesuai faktor (mis. Bench Press → Trisep 0,5) bila
 * `inclSecondary` true — sama seperti pembagian volume di Progress.
 * Gerakan di luar MUSCLE_SET_TRACKED (mis. Cardio) tidak dihitung.
 */
export function avgWeeklySetsPerMuscle(
  sessions: Session[],
  exercises: Exercise[],
  today: string,
  numWeeks: number = SET_TARGET_WEEKS,
  inclSecondary: boolean = true,
): { rows: MuscleSetRow[]; windowLabel: string } {
  const weeks = Math.max(1, Math.floor(numWeeks))
  const currentStart = mondayOf(today)
  const windows: Array<{ start: string; end: string }> = []
  for (let k = weeks - 1; k >= 0; k--) {
    const start = addDays(currentStart, -k * 7)
    windows.push({ start, end: addDays(start, 6) })
  }
  const totals = new Map<string, number>()
  const thisWeekTotals = new Map<string, number>()
  for (const m of MUSCLE_SET_TRACKED) {
    totals.set(m, 0)
    thisWeekTotals.set(m, 0)
  }
  const exById = new Map(exercises.map((e) => [e.id, e]))
  for (const s of sessions) {
    if (s.endedAt === null) continue
    const winIdx = windows.findIndex((w) => s.date >= w.start && s.date <= w.end)
    if (winIdx === -1) continue
    const isThisWeek = winIdx === windows.length - 1
    for (const set of s.sets) {
      const ex = exById.get(set.exerciseId)
      if (!ex || !MUSCLE_SET_TRACKED.includes(ex.muscleGroup)) continue
      totals.set(ex.muscleGroup, (totals.get(ex.muscleGroup) ?? 0) + 1)
      if (isThisWeek) thisWeekTotals.set(ex.muscleGroup, (thisWeekTotals.get(ex.muscleGroup) ?? 0) + 1)
      if (inclSecondary) {
        for (const f of secondaryFactorsFor(ex.name)) {
          if (!MUSCLE_SET_TRACKED.includes(f.group)) continue
          totals.set(f.group, (totals.get(f.group) ?? 0) + f.factor)
          if (isThisWeek) thisWeekTotals.set(f.group, (thisWeekTotals.get(f.group) ?? 0) + f.factor)
        }
      }
    }
  }
  const rows: MuscleSetRow[] = MUSCLE_SET_TRACKED.map((m) => ({
    muscle: m,
    avgPerWeek: (totals.get(m) ?? 0) / weeks,
    thisWeek: thisWeekTotals.get(m) ?? 0,
  })).sort((a, b) => b.avgPerWeek - a.avgPerWeek)
  const first = windows[0].start
  const last = windows[windows.length - 1].end
  const windowLabel =
    first.slice(0, 4) === last.slice(0, 4)
      ? `${fmtDay(first)}–${fmtDay(last)} ${first.slice(0, 4)}`
      : `${fmtDay(first)} ${first.slice(0, 4)}–${fmtDay(last)} ${last.slice(0, 4)}`
  return { rows, windowLabel }
}
