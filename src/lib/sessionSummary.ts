// Ringkasan sesi siap-tempel ke AI (Claude/dll): markdown ringkas berisi gerakan,
// set × beban × rep, volume, e1RM, dan pembanding vs sesi terakhir per gerakan.
import { formatDMYWIB, volumeOf } from './date'
import { getExerciseName, exerciseIsDuration, fmtNumber } from './helpers'
import { e1rm, e1rmStr } from './e1rm'
import type { Exercise, Session, SessionSet } from '../types'

export function isCardioExercise(exercises: Exercise[], exerciseId: string): boolean {
  const ex = exercises.find((e) => e.id === exerciseId)
  return !!ex && (ex.muscleGroup === 'Cardio' || ex.category === 'cardio')
}

function groupSets(sets: SessionSet[]): Map<string, SessionSet[]> {
  const grouped = new Map<string, SessionSet[]>()
  for (const s of sets) {
    const arr = grouped.get(s.exerciseId) ?? []
    arr.push(s)
    grouped.set(s.exerciseId, arr)
  }
  return grouped
}

// Sesi selesai TERBARU (selain current) yang memuat tiap gerakan —
// pembanding per gerakan, bukan sekadar "sesi sebelumnya" (split rotasi
// bisa menjeda satu gerakan beberapa siklus).
export function findPrevSessionsByExercise(
  sessions: Session[],
  current: Session,
): Map<string, Session> {
  const finished = sessions
    .filter((s) => s.id !== current.id && s.endedAt !== null)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.startedAt - a.startedAt))
  const result = new Map<string, Session>()
  for (const [exId] of groupSets(current.sets)) {
    const prev = finished.find((s) => s.sets.some((st) => st.exerciseId === exId))
    if (prev) result.set(exId, prev)
  }
  return result
}

function maxWeightOf(sets: SessionSet[]): number {
  return sets.reduce((m, s) => Math.max(m, s.weightKg), 0)
}

// Panah pembanding beban terbaik vs sesi pembanding gerakan yang sama.
function weightMarker(currentMax: number, prevMax: number): string {
  if (currentMax <= 0 || prevMax <= 0) return ''
  const delta = currentMax - prevMax
  if (delta > 0) return `↑${fmtNumber(delta)}kg vs sebelumnya`
  if (delta < 0) return `↓${fmtNumber(-delta)}kg vs sebelumnya`
  return '→ sama dengan sebelumnya'
}

function formatSetList(sets: SessionSet[], isDuration: boolean, isCardio: boolean): string {
  if (isDuration) {
    return sets
      .map((s) => `${fmtNumber(Math.round(((s.durationSec ?? 0) / 60) * 10) / 10)} mnt`)
      .join(', ')
  }
  if (isCardio) {
    return sets
      .map((s) => {
        const bits: string[] = []
        if (s.durationSec) bits.push(`${fmtNumber(Math.round((s.durationSec / 60) * 10) / 10)} mnt`)
        if (s.distanceKm) bits.push(`${fmtNumber(s.distanceKm)} km`)
        if (s.elevationM) bits.push(`${fmtNumber(s.elevationM)} m naik`)
        return bits.length > 0 ? bits.join(' · ') : '—'
      })
      .join(', ')
  }
  return sets.map((s) => (s.weightKg > 0 ? `${fmtNumber(s.weightKg)}kg×${s.reps}` : `BW×${s.reps}`)).join(', ')
}

export function formatSessionForAI(
  session: Session,
  exercises: Exercise[],
  prevByExercise: Map<string, Session> = new Map(),
): string {
  const lines: string[] = []

  const durasiMenit =
    session.endedAt != null ? Math.max(1, Math.round((session.endedAt - session.startedAt) / 60000)) : null
  lines.push(
    `Latihan ${formatDMYWIB(session.date)} — ${session.planName}${durasiMenit ? ` (${durasiMenit} menit)` : ''}`,
    '',
  )

  let idx = 1
  for (const [exId, sets] of groupSets(session.sets)) {
    const isDuration = !isCardioExercise(exercises, exId) && exerciseIsDuration(exercises, exId)
    const isCardio = isCardioExercise(exercises, exId)
    const name = getExerciseName(exercises, exId)
    const parts: string[] = [formatSetList(sets, isDuration, isCardio)]

    const vol = volumeOf(sets)
    if (vol > 0) parts.push(`vol ${fmtNumber(Math.round(vol))} kg`)
    if (!isCardio) {
      const bestE1 = sets.reduce((m, s) => (s.weightKg > 0 ? Math.max(m, e1rm(s.weightKg, s.reps)) : m), 0)
      if (bestE1 > 0) parts.push(`e1RM ~${e1rmStr(bestE1)} kg`)
    }

    const prev = prevByExercise.get(exId)
    if (prev && !isDuration && !isCardio) {
      const marker = weightMarker(maxWeightOf(sets), maxWeightOf(prev.sets.filter((s) => s.exerciseId === exId)))
      if (marker) parts.push(marker)
    }

    lines.push(`${idx}. ${name} — ${parts.join(' · ')}`)
    idx++
  }

  const totalVol = session.sets.reduce((acc, s) => acc + s.weightKg * (s.durationSec != null ? s.durationSec / 60 : s.reps), 0)
  const rpeVals = Object.values(session.rpes ?? {})
  const avgRpe = rpeVals.length > 0 ? rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length : null

  lines.push('')
  lines.push(
    `Total: ${session.sets.length} set · ${fmtNumber(Math.round(totalVol))} kg volume` +
      (avgRpe != null ? ` · RPE rata-rata ${fmtNumber(Math.round(avgRpe * 10) / 10)}` : ''),
  )
  if (session.note.trim()) lines.push(`Catatan: ${session.note.trim()}`)
  return lines.join('\n')
}
