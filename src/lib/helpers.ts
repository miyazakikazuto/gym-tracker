import type { Exercise } from '../types'

export function getExerciseName(exercises: Exercise[], id: string): string {
  return exercises.find((e) => e.id === id)?.name ?? 'Gerakan'
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