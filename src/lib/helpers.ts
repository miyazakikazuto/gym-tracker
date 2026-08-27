import type { Exercise, Session } from '../types'

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
  const c = ex.category || MUSCLE_TO_CATEGORY[ex.muscleGroup] || 'push'
  return c === 'home' ? 'easy' : c
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