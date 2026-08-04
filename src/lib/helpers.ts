import type { Exercise, Session } from '../types'

export function getExerciseName(exercises: Exercise[], id: string): string {
  return exercises.find((e) => e.id === id)?.name ?? 'Gerakan'
}

export function lastSetResult(
  sessions: Session[],
  excludeId: string,
  exerciseId: string,
  setNumber: number,
): { weightKg: number; reps: number } | null {
  const finished = sessions
    .filter((s) => s.id !== excludeId && s.endedAt !== null)
    .sort((a, b) => (b.date < a.date ? -1 : 1) || b.startedAt - a.startedAt)
  for (const s of finished) {
    const set = s.sets.find((x) => x.exerciseId === exerciseId && x.setNumber === setNumber)
    if (set && set.weightKg > 0) return { weightKg: set.weightKg, reps: set.reps }
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