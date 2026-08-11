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
  Kaki: 'leg',
  Cardio: 'cardio',
  Core: 'home',
  Lainnya: 'home',
}

export function categoryOfExercise(ex: { category?: string; muscleGroup: string }): string {
  return ex.category || MUSCLE_TO_CATEGORY[ex.muscleGroup] || 'push'
}

export function exerciseIsDuration(exercises: Exercise[], exerciseId: string): boolean {
  return exercises.find((e) => e.id === exerciseId)?.type === 'duration'
}

export function lastSetResult(
  sessions: Session[],
  excludeId: string,
  exerciseId: string,
  setNumber: number,
): { weightKg: number; reps: number; durationSec?: number } | null {
  const finished = sessions
    .filter((s) => s.id !== excludeId && s.endedAt !== null)
    .sort((a, b) => (b.date < a.date ? -1 : 1) || b.startedAt - a.startedAt)
  for (const s of finished) {
    const set = s.sets.find((x) => x.exerciseId === exerciseId && x.setNumber === setNumber)
    if (set && set.weightKg > 0) return { weightKg: set.weightKg, reps: set.reps, durationSec: set.durationSec }
  }
  return null
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

export function fmtNumber(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace('.', ',')
}