import type { Exercise, Session } from '../types'

export function getExerciseName(exercises: Exercise[], id: string): string {
  return exercises.find((e) => e.id === id)?.name ?? 'Gerakan'
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

export function lastSetResult(
  sessions: Session[],
  excludeId: string,
  exerciseId: string,
  setNumber: number,
): { weightKg: number; reps: number; durationSec?: number; distanceKm?: number } | null {
  const finished = sessions
    .filter((s) => s.id !== excludeId && s.endedAt !== null)
    .sort((a, b) => (b.date < a.date ? -1 : 1) || b.startedAt - a.startedAt)
  for (const s of finished) {
    const set = s.sets.find((x) => x.exerciseId === exerciseId && x.setNumber === setNumber)
    if (set && (set.weightKg > 0 || set.durationSec != null || (set.distanceKm ?? 0) > 0)) {
      return { weightKg: set.weightKg, reps: set.reps, durationSec: set.durationSec, distanceKm: set.distanceKm }
    }
  }
  return null
}

export function bestSetResult(
  sessions: Session[],
  excludeId: string,
  exerciseId: string,
): { weightKg: number; reps: number; durationSec?: number; distanceKm?: number } | null {
  let best: { primary: number; weightKg: number; reps: number; durationSec?: number; distanceKm?: number; date: string } | null = null
  for (const s of sessions) {
    if (s.id === excludeId || s.endedAt === null) continue
    for (const set of s.sets) {
      if (set.exerciseId !== exerciseId) continue
      const hasData = set.weightKg > 0 || set.durationSec != null || (set.distanceKm ?? 0) > 0
      if (!hasData) continue
      const km = set.distanceKm ?? 0
      const primary: number = set.weightKg > 0 ? set.weightKg : km > 0 ? km : set.durationSec ?? 0
      if (!best || primary > best.primary || (primary === best.primary && s.date > best.date)) {
        best = { primary, weightKg: set.weightKg, reps: set.reps, durationSec: set.durationSec, distanceKm: set.distanceKm, date: s.date }
      }
    }
  }
  if (!best) return null
  return { weightKg: best.weightKg, reps: best.reps, durationSec: best.durationSec, distanceKm: best.distanceKm }
}

export function groupSetsByExercise(
  sets: { exerciseId: string; setNumber: number; weightKg: number; reps: number }[],
) {
  const map = new Map<string, typeof sets>()
  for (const set of sets) {
    const arr = map.get(set.exerciseId) ?? []
    arr.push(set)
    map.set(set.exerciseId, arr)
  }
  return map
}

export function e1rmOf(weight: number, reps: number): number {
  return weight * (1 + reps / 30)
}

export function bestE1RmOf(sessions: Session[], excludeId: string, exerciseId: string): number {
  let best = 0
  for (const s of sessions) {
    if (s.id === excludeId || s.endedAt === null) continue
    for (const set of s.sets) {
      if (set.exerciseId !== exerciseId || set.weightKg <= 0) continue
      const e = e1rmOf(set.weightKg, set.reps)
      if (e > best) best = e
    }
  }
  return best
}

export function fmtNumber(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace('.', ',')
}