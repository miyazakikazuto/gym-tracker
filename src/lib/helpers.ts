import type { Exercise, Session } from '../types'
import { isRest } from './templates'

export function getExerciseName(exercises: Exercise[], id: string): string {
  return exercises.find((e) => e.id === id)?.name ?? `[Terhapus ${id.slice(0, 6)}]`
}

const MUSCLE_TO_CATEGORY: Record<string, string> = {
  Dada: 'push',
  Trisep: 'push',
  Bahu: 'push',
  Punggung: 'pull',
  Bisep: 'pull',
  Forearm: 'pull',
  Kaki: 'leg',
  Cardio: 'cardio',
  Core: 'easy',
  Lainnya: 'easy',
}

export function categoryOfExercise(ex: { category?: string; muscleGroup: string }): string {
  // Prioritas: category eksplisit → mapping muscleGroup → fallback 'push'.
  // Alias 'home' dianggap 'easy' (kategori lama). MuscleGroup kosong → fallback 'push'.
  const c = ex.category || MUSCLE_TO_CATEGORY[ex.muscleGroup] || 'push'
  return c === 'home' ? 'easy' : c
}

/**
 * True bila sesi dihitung dalam siklus 5/3/1 dan rotasi.
 * Kebalikan dari sesi non-counting: belum selesai, extra, Rest Day, Cardio, atau Skip.
 * Disatukan di sini agar `progression.ts` dan `rotation.ts` tidak divergen.
 * 5 predikat: endedAt null, isExtra, isRest(planName), /cardio/i, /^skip/i.
 */
export function isCountedSession(s: Session): boolean {
  if (s.endedAt === null) return false
  if (s.isExtra) return false
  if (isRest(s.planName)) return false
  if (/cardio/i.test(s.planName)) return false
  if (/^skip/i.test(s.planName.trim())) return false
  return true
}

export function categoryKeysOfExercise(ex: Exercise): string[] {
  const keys = [categoryOfExercise(ex), ...(ex.extraCategories ?? [])]
  return keys.filter((k, i) => keys.indexOf(k) === i)
}

export function exerciseIsDuration(exercises: Exercise[], exerciseId: string): boolean {
  return exercises.find((e) => e.id === exerciseId)?.type === 'duration'
}
export function bestSetResult(
  sessions: Session[],
  excludeId: string,
  exerciseId: string,
): { weightKg: number; reps: number; durationSec?: number; distanceKm?: number; elevationM?: number } | null {
  // Pilih set terbaik: primary = weightKg >0 ? weightKg : distanceKm>0 ? distanceKm : durationSec ??0
  // Set tanpa data (weightKg===0 && durationSec==null && distanceKm==0) dilewati via guard hasData.
  // Tie-break: s.date terbaru menang.
  let best: { primary: number; weightKg: number; reps: number; durationSec?: number; distanceKm?: number; elevationM?: number; date: string } | null = null
  for (const s of sessions) {
    if (s.id === excludeId || s.endedAt === null) continue
    for (const set of s.sets) {
      if (set.exerciseId !== exerciseId) continue
      const hasData = set.weightKg > 0 || set.durationSec != null || (set.distanceKm ?? 0) > 0
      if (!hasData) continue
      const km = set.distanceKm ?? 0
      const primary: number = set.weightKg > 0 ? set.weightKg : km > 0 ? km : set.durationSec ?? 0
      if (!best || primary > best.primary || (primary === best.primary && s.date > best.date)) {
        best = { primary, weightKg: set.weightKg, reps: set.reps, durationSec: set.durationSec, distanceKm: set.distanceKm, elevationM: set.elevationM, date: s.date }
      }
    }
  }
  if (!best) return null
  return { weightKg: best.weightKg, reps: best.reps, durationSec: best.durationSec, distanceKm: best.distanceKm, elevationM: best.elevationM }
}

export function fmtNumber(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace('.', ',')
}