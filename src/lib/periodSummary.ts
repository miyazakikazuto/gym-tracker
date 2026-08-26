// Rekap mingguan/bulanan siap-tempel ke AI: agregat sesi selesai dalam periode,
// volume per otot (primary saja — angka jujur, tanpa secondary), per gerakan
// dengan delta vs periode sebelumnya, dan tren berat badan.
import { addDays, MONTHS, todayKey, volumeOf, weekStart } from './date'
import { getExerciseName, fmtNumber } from './helpers'
import type { Bodyweight, Exercise, Session } from '../types'

export interface PeriodWindow {
  start: string // YYYY-MM-DD inklusif
  end: string // YYYY-MM-DD inklusif
}

export function weekWindow(today?: string): PeriodWindow {
  const t = today ?? todayKey()
  const start = weekStart(t)
  return { start, end: addDays(start, 6) }
}

export function monthWindow(today?: string): PeriodWindow {
  const key = today ?? todayKey()
  const [y, m] = key.split('-').map(Number)
  const mm = String(m).padStart(2, '0')
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(lastDay).padStart(2, '0')}` }
}

export function prevWeekWindow(w: PeriodWindow): PeriodWindow {
  return { start: addDays(w.start, -7), end: addDays(w.end, -7) }
}

export function prevMonthWindow(w: PeriodWindow): PeriodWindow {
  const [y, m] = w.start.split('-').map(Number)
  const pm = m === 1 ? 12 : m - 1
  const py = m === 1 ? y - 1 : y
  const lastDay = new Date(Date.UTC(py, pm, 0)).getUTCDate()
  const mm = String(pm).padStart(2, '0')
  return { start: `${py}-${mm}-01`, end: `${py}-${mm}-${String(lastDay).padStart(2, '0')}` }
}

function inPeriod(s: Session, w: PeriodWindow): boolean {
  return s.endedAt !== null && s.date >= w.start && s.date <= w.end
}

function fmtRange(w: PeriodWindow): string {
  const [, m1, d1] = w.start.split('-')
  const [y2, m2, d2] = w.end.split('-')
  if (w.start.slice(0, 7) === w.end.slice(0, 7)) {
    return `${d1}–${d2} ${MONTHS[Number(m2) - 1]} ${y2}`
  }
  return `${d1} ${MONTHS[Number(m1) - 1]} – ${d2} ${MONTHS[Number(m2) - 1]} ${y2}`
}

function totalVolume(sessions: Session[]): number {
  let vol = 0
  for (const s of sessions) vol += volumeOf(s.sets)
  return vol
}

interface ExerciseAgg {
  sets: number
  vol: number
  bestWeight: number
  bestReps: number
  durationSec: number
  distanceKm: number
  elevationM: number
  isCardioLike: boolean
}

function aggregateByExercise(sessions: Session[], cardioIds: Set<string>): Map<string, ExerciseAgg> {
  const map = new Map<string, ExerciseAgg>()
  for (const s of sessions) {
    for (const set of s.sets) {
      let a = map.get(set.exerciseId)
      if (!a) {
        a = {
          sets: 0,
          vol: 0,
          bestWeight: 0,
          bestReps: 0,
          durationSec: 0,
          distanceKm: 0,
          elevationM: 0,
          isCardioLike: cardioIds.has(set.exerciseId),
        }
        map.set(set.exerciseId, a)
      }
      a.sets += 1
      a.vol += volumeOf([set])
      if (set.weightKg > a.bestWeight) {
        a.bestWeight = set.weightKg
        a.bestReps = set.reps
      }
      a.durationSec += set.durationSec ?? 0
      a.distanceKm += set.distanceKm ?? 0
      a.elevationM += set.elevationM ?? 0
    }
  }
  return map
}

function deltaMarker(cur: number, prev: number): string {
  if (prev <= 0 && cur <= 0) return ''
  if (prev <= 0) return '· baru periode ini'
  const d = cur - prev
  if (Math.abs(d) < 0.5) return '→ volume sama dengan periode lalu'
  return d > 0
    ? `↑${fmtNumber(Math.round(d))} kg vs periode lalu`
    : `↓${fmtNumber(Math.round(-d))} kg vs periode lalu`
}

export function formatPeriodForAI(input: {
  sessions: Session[]
  exercises: Exercise[]
  bodyweights: Bodyweight[]
  window: PeriodWindow
  prev?: PeriodWindow
  kind?: 'mingguan' | 'bulanan'
}): string {
  const { sessions, exercises, bodyweights, window: w, prev, kind = 'mingguan' } = input

  const title =
    kind === 'bulanan'
      ? `Rekap Bulanan Latihan — ${MONTHS[Number(w.start.slice(5, 7)) - 1]} ${w.start.slice(0, 4)}`
      : `Rekap Mingguan Latihan — ${fmtRange(w)}`

  const finished = sessions.filter((s) => inPeriod(s, w))
  const lines: string[] = [title, '']

  if (finished.length === 0) {
    lines.push('Tidak ada sesi selesai dalam periode ini.')
    return lines.join('\n')
  }

  // Sesi per plan
  const byPlan = new Map<string, number>()
  for (const s of finished) byPlan.set(s.planName, (byPlan.get(s.planName) ?? 0) + 1)
  const planText = Array.from(byPlan.entries()).map(([p, n]) => (n > 1 ? `${p} ×${n}` : p)).join(' · ')
  lines.push(`Sesi selesai: ${finished.length} (${planText})`)

  const totalSets = finished.reduce((a, s) => a + s.sets.length, 0)
  const totalMin = Math.round(finished.reduce((a, s) => a + ((s.endedAt ?? s.startedAt) - s.startedAt), 0) / 60000)
  lines.push(
    `Total: ${totalSets} set · ${fmtNumber(Math.round(totalVolume(finished)))} kg volume · ${Math.floor(totalMin / 60)} j ${totalMin % 60} mnt`,
    '',
  )

  // Volume per grup otot — primary saja (angka jujur)
  const muscleVol = new Map<string, number>()
  for (const s of finished) {
    for (const set of s.sets) {
      const mg = exercises.find((e) => e.id === set.exerciseId)?.muscleGroup
      if (!mg || mg === 'Cardio') continue
      muscleVol.set(mg, (muscleVol.get(mg) ?? 0) + volumeOf([set]))
    }
  }
  const muscles = Array.from(muscleVol.entries()).sort((a, b) => b[1] - a[1])
  if (muscles.length > 0) {
    lines.push('Volume per otot:')
    for (const [mg, v] of muscles) lines.push(`- ${mg}: ${fmtNumber(Math.round(v))} kg`)
    lines.push('')
  }

  // Per gerakan + delta vs periode sebelumnya
  const cardioIds = new Set(
    exercises.filter((e) => e.muscleGroup === 'Cardio' || e.category === 'cardio').map((e) => e.id),
  )
  const agg = aggregateByExercise(finished, cardioIds)
  const aggPrev = prev ? aggregateByExercise(sessions.filter((s) => inPeriod(s, prev)), cardioIds) : null

  lines.push('Per gerakan:')
  let idx = 1
  for (const [exId, a] of agg) {
    const name = getExerciseName(exercises, exId)
    const bits: string[] = []
    if (a.isCardioLike || a.bestWeight === 0) {
      if (a.durationSec > 0) bits.push(`${fmtNumber(Math.round((a.durationSec / 60) * 10) / 10)} mnt`)
      if (a.distanceKm > 0) bits.push(`${fmtNumber(Math.round(a.distanceKm * 10) / 10)} km`)
      if (a.elevationM > 0) bits.push(`${fmtNumber(Math.round(a.elevationM))} m naik`)
      if (bits.length === 0) bits.push('—')
    } else {
      if (a.bestWeight > 0) bits.push(`terbaik ${fmtNumber(a.bestWeight)}kg×${a.bestReps}`)
    }
    if (!a.isCardioLike && a.vol > 0) bits.push(`vol ${fmtNumber(Math.round(a.vol))} kg`)
    const marker = aggPrev ? deltaMarker(a.vol, aggPrev.get(exId)?.vol ?? 0) : ''
    lines.push(`${idx}. ${name} — ${a.sets} set · ${bits.join(' · ')}${marker ? ` ${marker}` : ''}`)
    idx++
  }
  lines.push('')

  // Berat badan dalam periode
  const bw = bodyweights.filter((b) => b.date >= w.start && b.date <= w.end).sort((a, b) => a.date.localeCompare(b.date))
  if (bw.length >= 2) {
    const d = bw[bw.length - 1].kg - bw[0].kg
    lines.push(
      `Berat badan: ${fmtNumber(bw[0].kg)} → ${fmtNumber(bw[bw.length - 1].kg)} kg (${d >= 0 ? '+' : '−'}${fmtNumber(Math.abs(Math.round(d * 10) / 10))})`,
    )
  } else if (bw.length === 1) {
    lines.push(`Berat badan: ${fmtNumber(bw[0].kg)} kg`)
  }

  return lines.join('\n')
}

// ===== Opsi periode untuk dropdown rekap =====

export interface PeriodOption {
  start: string
  end: string
  label: string
}

function earliestSessionDate(sessions: Session[]): string | null {
  let earliest: string | null = null
  for (const s of sessions) {
    if (s.endedAt === null) continue
    if (!earliest || s.date < earliest) earliest = s.date
  }
  return earliest
}

// Daftar minggu dari minggu sesi pertama sampai minggu berjalan (terbaru dulu).
// Tanpa data → cukup minggu berjalan. Cap 52 minggu TERBARU (yang tua dipangkas).
export function listWeekOptions(sessions: Session[], today?: string): PeriodOption[] {
  const t = today ?? todayKey()
  const earliest = earliestSessionDate(sessions)
  const current = weekWindow(t)
  let cursor = weekStart(earliest && earliest < t ? earliest : t)
  // Jaga-jaga data masa depan aneh: mulai tak boleh lewat dari minggu berjalan.
  if (cursor > current.start) cursor = current.start

  // Cap dari sisi terbaru: minggu berjalan wajib ikut.
  const floor = addDays(current.start, -51 * 7)
  if (cursor < floor) cursor = floor

  const options: PeriodOption[] = []
  while (cursor <= current.start && options.length < 52) {
    const end = addDays(cursor, 6)
    options.push({ start: cursor, end, label: fmtRange({ start: cursor, end }) })
    cursor = addDays(cursor, 7)
  }
  return options.reverse()
}

// Daftar bulan kalender dari bulan sesi pertama sampai bulan berjalan (terbaru dulu).
export function listMonthOptions(sessions: Session[], today?: string): PeriodOption[] {
  const t = today ?? todayKey()
  const ty = Number(t.slice(0, 4))
  const tm = Number(t.slice(5, 7))
  const earliest = earliestSessionDate(sessions)

  let y = earliest ? Number(earliest.slice(0, 4)) : ty
  let m = earliest ? Number(earliest.slice(5, 7)) : tm

  const options: PeriodOption[] = []
  while (y < ty || (y === ty && m <= tm)) {
    const mm = String(m).padStart(2, '0')
    const w = monthWindow(`${y}-${mm}-15`)
    options.push({ ...w, label: `${MONTHS[m - 1]} ${y}` })
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return options.reverse()
}
