import type { Exercise, Session } from '../types'

export const SBD_LIFTS = [
  {
    key: 'squat',
    label: 'Squat',
    keyword: 'squat',
    exclude: ['front', 'box', 'pistol', 'sissy', 'bulgarian', 'goblet', 'hack', 'smith', 'machine', 'split'],
  },
  {
    key: 'bench',
    label: 'Bench Press',
    keyword: 'bench',
    exclude: ['incline', 'decline', 'dumbbell', 'machine', 'smith', 'floor', 'grip', 'reverse'],
  },
  {
    key: 'deadlift',
    label: 'Deadlift',
    keyword: 'deadlift',
    exclude: ['romanian', 'stiff', 'rack', 'deficit', 'snatch', 'trap', 'goblet', 'hack', 'smith', 'machine'],
  },
] as const

export function isSbdExercise(ex: Exercise, liftKey: string): boolean {
  const lift = SBD_LIFTS.find((l) => l.key === liftKey)
  if (!lift) return false
  const n = ex.name.toLowerCase()
  if (!n.includes(lift.keyword)) return false
  return !lift.exclude.some((k) => n.includes(k))
}

// Beban terberat all-time per lift (Squat/Bench/Deadlift) + tanggal PR-nya
export function sbdBestLifts(sessions: Session[], exercises: Exercise[]): { key: string; label: string; best: number; date: string | null }[] {
  return SBD_LIFTS.map((lift) => {
    let best = 0
    let bestDate: string | null = null
    for (const s of sessions) {
      // Hanya sesi yang sudah selesai — sesi berjalan bisa overcount PR sementara
      if (s.endedAt == null) continue
      for (const set of s.sets) {
        if (set.weightKg <= best) continue
        const ex = exercises.find((e) => e.id === set.exerciseId)
        if (ex && isSbdExercise(ex, lift.key)) {
          best = set.weightKg
          bestDate = s.date
        }
      }
    }
    return { key: lift.key, label: lift.label, best, date: bestDate }
  })
}