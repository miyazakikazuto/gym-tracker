// Saran gerakan pintar saat tambah ke sesi: gap volume otot dalam window
// se-kategori + frekuensi pemakaian + belum-pernah. Pure function, testable.
import { addDays, parseKey, todayKey, volumeOf } from './date'
import type { Exercise, Session } from '../types'

export type Reason = 'gap' | 'baru' | 'lupa' | 'biasa'

export interface Suggestion {
  exercise: Exercise
  reason: Reason
  daysSinceLast: number | null
}

export function suggestExercises(
  sessions: Session[],
  exercises: Exercise[],
  pool: Exercise[],
  currentSetIds: Set<string>,
  opts: { weeks?: number; forgetDays?: number } = {},
): Suggestion[] {
  const weeks = opts.weeks ?? 4
  const forgetDays = opts.forgetDays ?? 21

  const cutoff = addDays(todayKey(), -weeks * 7)

  // Volume per muscleGroup dalam window se-kategori (sesi selesai saja)
  const volByMuscle = new Map<string, number>()
  for (const s of sessions) {
    if (s.endedAt === null || s.date < cutoff) continue
    for (const set of s.sets) {
      const mg = exercises.find((e) => e.id === set.exerciseId)?.muscleGroup
      if (!mg) continue
      // Hanya hitung jika gerakannya ada di pool (kategori sesi) — cegah Cardio mengotori gap Push
      // Pool berisi gerakan se-kategori; filter via id ada di pool
      const inPoolCategory = pool.some((p) => p.muscleGroup === mg)
      if (!inPoolCategory) continue
      volByMuscle.set(mg, (volByMuscle.get(mg) ?? 0) + volumeOf([set]))
    }
  }
  const vals = Array.from(volByMuscle.values())
  const avgVol = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  const gapMuscles = new Set<string>()
  for (const [mg, v] of volByMuscle) {
    if (v < avgVol * 0.3) gapMuscles.add(mg)
  }
  // Grup otot di pool yang 0 volume dalam window juga gap
  for (const ex of pool) {
    if (!volByMuscle.has(ex.muscleGroup)) gapMuscles.add(ex.muscleGroup)
  }

  // Last performed per exercise
  const lastDateByEx = new Map<string, string>()
  for (const s of sessions) {
    if (s.endedAt === null) continue
    for (const set of s.sets) {
      const cur = lastDateByEx.get(set.exerciseId)
      if (!cur || s.date > cur) lastDateByEx.set(set.exerciseId, s.date)
    }
  }

  const today = todayKey()
  const scored: Suggestion[] = []
  for (const ex of pool) {
    if (currentSetIds.has(ex.id)) continue
    const last = lastDateByEx.get(ex.id)
    let reason: Reason = 'biasa'
    let daysSinceLast: number | null = null
    if (!last) {
      reason = 'baru'
    } else {
      const diff = Math.round(
        (parseKey(today).getTime() - parseKey(last).getTime()) / 86400000,
      )
      daysSinceLast = diff
      if (gapMuscles.has(ex.muscleGroup)) reason = 'gap'
      else if (diff >= forgetDays) reason = 'lupa'
    }
    // gap juga berlaku untuk yang baru jika grupnya gap — prioritas gap
    if (reason === 'baru' && gapMuscles.has(ex.muscleGroup)) reason = 'gap'
    scored.push({ exercise: ex, reason, daysSinceLast })
  }

  const rank: Record<Reason, number> = { gap: 0, baru: 1, lupa: 2, biasa: 3 }
  scored.sort((a, b) => {
    const r = rank[a.reason] - rank[b.reason]
    if (r !== 0) return r
    return (b.daysSinceLast ?? 9999) - (a.daysSinceLast ?? 9999)
  })

  return scored
}
