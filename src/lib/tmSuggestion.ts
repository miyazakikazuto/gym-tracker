// Saran Training Max 5/3/1 yang personal: e1RM terbaik (Epley) dari riwayat
// set Squat/Bench/Deadlift asli dalam window N minggu × faktor 90%,
// dibulatkan ke 2,5 kg. Murni saran — tidak pernah menulis settings.
import { addDays, todayKey } from './date'
import { e1rm } from './e1rm'
import { isSbdExercise, SBD_LIFTS } from './sbd'
import type { Exercise, Session, UserSettings } from '../types'

export type TmStatus = 'naik' | 'turun' | 'pas'

export interface TmSuggestion {
  key: (typeof SBD_LIFTS)[number]['key']
  label: string
  bestE1rm: number
  suggestedTm: number
  currentTm: number
  status: TmStatus
  hasData: boolean
  // true = window kosong, angka dihitung dari seluruh riwayat
  fallbackAllTime: boolean
}

export function roundTo2_5(n: number): number {
  return Math.round(n / 2.5) * 2.5
}

function shiftDate(iso: string, days: number): string {
  return addDays(iso, -days)
}

function bestE1rmForLift(
  sessions: Session[],
  exercises: Exercise[],
  liftKey: string,
  cutoff: string | null,
): number {
  let best = 0
  for (const s of sessions) {
    if (s.endedAt === null) continue
    if (cutoff && s.date < cutoff) continue
    for (const set of s.sets) {
      if (set.weightKg <= 0 || set.reps < 1) continue
      const ex = exercises.find((e) => e.id === set.exerciseId)
      if (!ex || !isSbdExercise(ex, liftKey)) continue
      const e = e1rm(set.weightKg, set.reps)
      if (e > best) best = e
    }
  }
  return best
}

function statusOf(suggested: number, current: number): TmStatus {
  const delta = suggested - current
  if (Math.abs(delta) < 2.5) return 'pas'
  return delta > 0 ? 'naik' : 'turun'
}

export function suggestTm(
  sessions: Session[],
  exercises: Exercise[],
  trainingMax: UserSettings['trainingMax'] | undefined,
  opts: { weeks?: number; today?: string } = {},
): TmSuggestion[] {
  const weeks = opts.weeks ?? 8
  const today = opts.today ?? todayKey()
  const cutoff = shiftDate(today, weeks * 7)

  return SBD_LIFTS.map((lift) => {
    const bestWindow = bestE1rmForLift(sessions, exercises, lift.key, cutoff)
    const bestAll = bestWindow > 0 ? bestWindow : bestE1rmForLift(sessions, exercises, lift.key, null)
    const hasData = bestAll > 0
    const currentTm = trainingMax?.[lift.key] ?? 0
    const suggestedTm = hasData ? roundTo2_5(bestAll * 0.9) : 0
    return {
      key: lift.key,
      label: lift.label,
      bestE1rm: Math.round(bestAll * 10) / 10,
      suggestedTm,
      currentTm,
      status: statusOf(suggestedTm, currentTm),
      hasData,
      fallbackAllTime: !bestWindow && hasData,
    }
  })
}
