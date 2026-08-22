// 5/3/1 Session Tracking — Wendler periodization adapted for irregular schedules.
// Position dihitung dari jumlah sesi selesai (bukan tanggal/minggu).
// Default: 1 cycle = 16 sesi [Leg/Push/Pull/Easy] × 4 minggu.
// Toggle Easy Day OFF: 1 cycle = 12 sesi [Leg/Push/Pull] × 4 minggu.

import { isRest } from './templates'
import type { Session, UserSettings } from '../types'

// ===== STATIC DATA (full — tanpa exclusion) =====

const ALL_SESSION_TYPES: ('leg' | 'push' | 'pull' | 'easy')[] = [
  'leg', 'push', 'pull', 'easy',   // Week 1 — 3×5
  'leg', 'push', 'pull', 'easy',   // Week 2 — 3×3
  'leg', 'push', 'pull', 'easy',   // Week 3 — 5/3/1
  'leg', 'push', 'pull', 'easy',   // Week 4 — Deload
]

const ALL_SESSION_LABELS = [
  'Leg Day — 3×5',    'Push — 3×5',    'Pull Day',         'Easy Day',
  'Leg Day — 3×3',    'Push — 3×3',    'Pull Day',         'Easy Day',
  'Leg Day — 5/3/1',  'Push — 5/3/1',  'Pull Day',         'Easy Day',
  'Leg Day — Deload',  'Push — Deload',  'Pull Day',         'Easy Day',
]

// Lift yang dipakai di sesi 5/3/1 (index 8 = squat, index 9 = bench)
const SBD_KEY: Record<number, 'squat' | 'bench' | 'deadlift'> = {
  8: 'squat',
  9: 'bench',
}

// Persentase TM per scheme
interface Scheme {
  type: '3x5' | '3x3' | '531' | 'deload' | null
  label: string
  lift?: 'squat' | 'bench' | 'deadlift'
  percentages: number[]
  sets: number
  reps: number | number[]
}

const ALL_SCHEMES: Record<number, Scheme> = {
  0:  { type: '3x5',   label: '3×5',   percentages: [65],          sets: 3, reps: 5 },
  1:  { type: '3x5',   label: '3×5',   percentages: [65],          sets: 3, reps: 5 },
  4:  { type: '3x3',   label: '3×3',   percentages: [75],          sets: 3, reps: 3 },
  5:  { type: '3x3',   label: '3×3',   percentages: [75],          sets: 3, reps: 3 },
  8:  { type: '531',   label: '5/3/1', percentages: [70, 80, 90],  sets: 3, reps: [5, 3, 1], lift: 'squat' },
  9:  { type: '531',   label: '5/3/1', percentages: [70, 80, 90],  sets: 3, reps: [5, 3, 1], lift: 'bench' },
  12: { type: 'deload', label: 'Deload', percentages: [40, 50],    sets: 2, reps: 5 },
  13: { type: 'deload', label: 'Deload', percentages: [40, 50],    sets: 2, reps: 5 },
}

// 5/3/1 Leg progression: squat di index 8, deadlift di index 12 (deload)
// Full: 8=squat, 9=bench
// Without easy: 8=squat, 9=bench (index berubah tapi lift sama)
// Deadlift: tidak ada di default 5/3/1 — user bisa pakai di Pull/Hard day

// ===== EXCLUSION HELPERS =====

/** Set of session types to exclude from cycle. */
export function computeExcludedTypes(settings: Partial<UserSettings>): Set<string> {
  const excluded = new Set<string>()
  if (settings.excludeEasyDay) excluded.add('easy')
  return excluded
}

/** Dynamic cycle length after exclusion. */
export function dynamicCycleLength(excluded: Set<string>): number {
  return ALL_SESSION_TYPES.filter((t) => !excluded.has(t)).length
}

/** Build effective arrays (types, labels, schemes) after exclusion. */
function buildEffective(excluded: Set<string>) {
  const types: string[] = []
  const labels: string[] = []
  const schemes: Map<number, Scheme> = new Map()
  const allSbdKey: Record<number, 'squat' | 'bench' | 'deadlift'> = {}
  let newIdx = 0

  for (let i = 0; i < ALL_SESSION_TYPES.length; i++) {
    if (excluded.has(ALL_SESSION_TYPES[i])) continue
    types.push(ALL_SESSION_TYPES[i])
    labels.push(ALL_SESSION_LABELS[i])
    if (ALL_SCHEMES[i]) schemes.set(newIdx, ALL_SCHEMES[i])
    if (SBD_KEY[i]) allSbdKey[newIdx] = SBD_KEY[i]
    newIdx++
  }

  return { types, labels, schemes, sbdKey: allSbdKey }
}

// ===== COUNTER LOGIC =====

/** Hitung total sesi selesai yang dihitung dalam siklus 5/3/1. */
function countCompletedSessions(sessions: Session[]): number {
  let count = 0
  for (const s of sessions) {
    if (s.endedAt === null) continue
    if (isRest(s.planName)) continue
    if (/cardio/i.test(s.planName)) continue
    count++
  }
  return count
}

export interface CyclePosition {
  cycle: number
  sessionIndex: number
  totalCompleted: number
  cycleLength: number
}

/** Hitung posisi saat ini dalam siklus 5/3/1. */
export function computePosition(
  sessions: Session[],
  excluded: Set<string> = new Set(),
): CyclePosition {
  const total = countCompletedSessions(sessions)
  const cycleLen = dynamicCycleLength(excluded)
  return {
    cycle: Math.floor(total / cycleLen) + 1,
    sessionIndex: total % cycleLen,
    totalCompleted: total,
    cycleLength: cycleLen,
  }
}

// ===== SCHEME LOOKUP (dynamic) =====

export function getSessionType(index: number, excluded: Set<string> = new Set()): string {
  const { types } = buildEffective(excluded)
  return types[index % types.length] ?? 'leg'
}

export function getSessionLabel(index: number, excluded: Set<string> = new Set()): string {
  const { labels } = buildEffective(excluded)
  return labels[index % labels.length] ?? ''
}

export function getFullLabel(cycle: number, index: number, excluded: Set<string> = new Set()): string {
  return `[C${cycle}-S${String(index + 1).padStart(2, '0')}] ${getSessionLabel(index, excluded)}`
}

export function getScheme(index: number, excluded: Set<string> = new Set()): Scheme | null {
  const { schemes } = buildEffective(excluded)
  return schemes.get(index % schemes.size) ?? null
}

// ===== PRESCRIBED WEIGHTS =====

export interface PrescribedSet {
  percentage: number
  weight: number
  reps: number | string
}

export function getPrescribedWeights(scheme: Scheme, tm: number): PrescribedSet[] {
  if (tm <= 0 || scheme.type === null) return []
  return scheme.percentages.map((pct, i) => ({
    percentage: pct,
    weight: Math.round((tm * pct / 100) * 2) / 2,
    reps: Array.isArray(scheme.reps) ? scheme.reps[i] : scheme.reps,
  }))
}

export function getSbdLiftForSession(
  index: number,
  excluded: Set<string> = new Set(),
): 'squat' | 'bench' | 'deadlift' | undefined {
  const { sbdKey } = buildEffective(excluded)
  return sbdKey[index]
}

// ===== TM MANAGEMENT =====

export function nextTMFromAMRAP(weightKg: number, reps: number, currentTM: number): number {
  if (weightKg <= 0 || reps <= 0) return currentTM
  const e1rm = weightKg * (1 + reps / 30)
  const raw = e1rm * 0.9
  return Math.round(raw / 2.5) * 2.5
}

// ===== CYCLE TRANSITION =====

export function isCycleTransition(prevIndex: number, currentIndex: number, cycleLength: number): boolean {
  return prevIndex === cycleLength - 1 && currentIndex === 0
}

export function resetCycle(): { cycleNumber: number; sessionIndex: number } {
  return { cycleNumber: 1, sessionIndex: 0 }
}

// ===== SKIP LOGIC =====

export function positionAfterSkip(currentIndex: number): number {
  return currentIndex
}

export function positionAfterSession(currentIndex: number, cycleLength: number): number {
  return (currentIndex + 1) % cycleLength
}

// ===== 5/3/1 SUGGESTION KEY (dynamic) =====

const ROTATION = ['leg', 'easy', 'push', 'pull'] as const

/** Key preset untuk sesi 5/3/1 berdasarkan sessionIndex. */
export function suggestKey531(
  sessionIndex: number,
  excluded: Set<string> = new Set(),
): string {
  const { types } = buildEffective(excluded)
  return types[sessionIndex % types.length] ?? 'leg'
}

/** Next key in rotation, respecting exclusion. */
export function nextRotationKey(
  currentKey: string,
  excluded: Set<string> = new Set(),
): string {
  const idx = ROTATION.indexOf(currentKey as typeof ROTATION[number])
  if (idx === -1) return currentKey
  for (let step = 1; step <= ROTATION.length; step++) {
    const next = ROTATION[(idx + step) % ROTATION.length]
    if (!excluded.has(next)) return next
  }
  return currentKey
}

/** 5/3/1 sequence untuk UI. */
export function get531Sequence(excluded: Set<string> = new Set()) {
  const { types, labels, schemes } = buildEffective(excluded)
  return types.map((key, i) => ({
    key,
    label: labels[i],
    scheme: schemes.get(i)?.label ?? '',
  }))
}

/** Deadlift lift key for deload (index 12 = squat in standard, but we want deadlift). */
export function getDeloadLiftKey(
  index: number,
  excluded: Set<string> = new Set(),
): 'squat' | 'bench' | 'deadlift' | undefined {
  const { sbdKey } = buildEffective(excluded)
  return sbdKey[index]
}
