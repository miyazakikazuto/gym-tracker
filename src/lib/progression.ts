// 5/3/1 Session Tracking — Wendler periodization adapted for irregular schedules.
// Position dihitung dari jumlah sesi selesai (bukan tanggal/minggu).
// 1 cycle = 16 sesi: [3×5] → [3×3] → [5/3/1] → [Deload], masing-masing Leg/Pull/Pull/Easy.

import { isRest } from './templates'
import type { Session } from '../types'

export const CYCLE_LENGTH = 16

// Tipe setiap sesi dalam cycle (index 0-15)
export const SESSION_TYPES: ('leg' | 'push' | 'pull' | 'easy')[] = [
  'leg', 'push', 'pull', 'easy',   // Week 1 — 3×5
  'leg', 'push', 'pull', 'easy',   // Week 2 — 3×3
  'leg', 'push', 'pull', 'easy',   // Week 3 — 5/3/1
  'leg', 'push', 'pull', 'easy',   // Week 4 — Deload
]

// Label ringkas per sesi
const SESSION_LABELS = [
  'Leg Day — 3×5',    'Push — 3×5',    'Pull Day',         'Easy Day',
  'Leg Day — 3×3',    'Push — 3×3',    'Pull Day',         'Easy Day',
  'Leg Day — 5/3/1',  'Push — 5/3/1',  'Pull Day',         'Easy Day',
  'Leg Day — Deload',  'Push — Deload',  'Pull Day',         'Easy Day',
]

// Lift mana yang dipakai di sesi 5/3/1 (index 8 = squat, index 9 = bench)
const SBD_KEY: Record<number, 'squat' | 'bench' | 'deadlift'> = {
  8: 'squat',
  9: 'bench',
}

// Persentase TM per scheme
interface Scheme {
  type: '3x5' | '3x3' | '531' | 'deload' | null
  label: string
  lift?: 'squat' | 'bench' | 'deadlift' // untuk 5/3/1
  percentages: number[]                  // mis. [65] atau [70,80,90]
  sets: number
  reps: number | number[]                // number[] untuk 5/3/1 (5,3,1+)
}

const SCHEMES: Record<number, Scheme> = {
  // Week 1 — 3×5
  0: { type: '3x5',  label: '3×5',  percentages: [65],           sets: 3, reps: 5 },
  1: { type: '3x5',  label: '3×5',  percentages: [65],           sets: 3, reps: 5 },
  // Week 2 — 3×3
  4: { type: '3x3',  label: '3×3',  percentages: [75],           sets: 3, reps: 3 },
  5: { type: '3x3',  label: '3×3',  percentages: [75],           sets: 3, reps: 3 },
  // Week 3 — 5/3/1
  8: { type: '531',  label: '5/3/1', percentages: [70, 80, 90],  sets: 3, reps: [5, 3, 1], lift: 'squat' },
  9: { type: '531',  label: '5/3/1', percentages: [70, 80, 90],  sets: 3, reps: [5, 3, 1], lift: 'bench' },
  // Week 4 — Deload
  12: { type: 'deload', label: 'Deload', percentages: [40, 50], sets: 2, reps: 5 },
  13: { type: 'deload', label: 'Deload', percentages: [40, 50], sets: 2, reps: 5 },
}

// ===== COUNTER LOGIC =====

/** Hitung total sesi selesai yang dihitung dalam siklus 5/3/1.
 *  Bukan Rest Day, bukan Cardio. */
function countCompletedSessions(sessions: Session[]): number {
  let count = 0
  for (const s of sessions) {
    if (s.endedAt === null) continue
    if (isRest(s.planName)) continue
    // Cardio tidak dihitung
    if (/cardio/i.test(s.planName)) continue
    count++
  }
  return count
}

export interface CyclePosition {
  cycle: number       // 1-based
  sessionIndex: number // 0-15
  totalCompleted: number
}

/** Hitung posisi saat ini dalam siklus 5/3/1. */
export function computePosition(sessions: Session[]): CyclePosition {
  const total = countCompletedSessions(sessions)
  return {
    cycle: Math.floor(total / CYCLE_LENGTH) + 1,
    sessionIndex: total % CYCLE_LENGTH,
    totalCompleted: total,
  }
}

// ===== SCHEME LOOKUP =====

/** Tipe sesi berdasarkan index (leg/push/pull/easy). */
export function getSessionType(index: number): string {
  return SESSION_TYPES[index % CYCLE_LENGTH] ?? 'leg'
}

/** Label sesi — mis. "Leg Day — 3×5", "Pull Day". */
export function getSessionLabel(index: number): string {
  return SESSION_LABELS[index % CYCLE_LENGTH] ?? ''
}

/** Full label dengan cycle — mis. "[C1-S05] Leg Day — 3×3". */
export function getFullLabel(cycle: number, index: number): string {
  return `[C${cycle}-S${String(index + 1).padStart(2, '0')}] ${getSessionLabel(index)}`
}

/** Scheme untuk sesi tertentu (null untuk Pull/Easy). */
export function getScheme(index: number): Scheme | null {
  return SCHEMES[index % CYCLE_LENGTH] ?? null
}

// ===== PRESCRIBED WEIGHTS =====

export interface PrescribedSet {
  percentage: number
  weight: number   // kg (dibulatkan ke 0.5 terdekat)
  reps: number | string  // number atau "1+" (AMRAP)
}

/** Hitung beban yang diresepkan berdasarkan TM. */
export function getPrescribedWeights(scheme: Scheme, tm: number): PrescribedSet[] {
  if (tm <= 0 || scheme.type === null) return []
  return scheme.percentages.map((pct, i) => ({
    percentage: pct,
    weight: Math.round((tm * pct / 100) * 2) / 2, // bulatkan ke 0.5
    reps: Array.isArray(scheme.reps) ? scheme.reps[i] : scheme.reps,
  }))
}

/** Lift key untuk sesi 5/3/1 (undefined jika bukan sesi SBD). */
export function getSbdLiftForSession(index: number): 'squat' | 'bench' | 'deadlift' | undefined {
  return SBD_KEY[index]
}

// ===== TM MANAGEMENT =====

/** Hitung TM baru dari hasil AMRAP (set terakhir 5/3/1).
 *  Formula: e1rm × 0.9, dibulatkan ke 2.5 terdekat. */
export function nextTMFromAMRAP(weightKg: number, reps: number, currentTM: number): number {
  if (weightKg <= 0 || reps <= 0) return currentTM
  const e1rm = weightKg * (1 + reps / 30)
  const raw = e1rm * 0.9
  // Bulatkan ke 2.5 terdekat
  return Math.round(raw / 2.5) * 2.5
}

// ===== CYCLE TRANSITION =====

/** Cek apakah cycle baru saja selesai (transition dari S16 → S01). */
export function isCycleTransition(prevIndex: number, currentIndex: number): boolean {
  return prevIndex === CYCLE_LENGTH - 1 && currentIndex === 0
}

/** Reset cycle ke awal. */
export function resetCycle(): { cycleNumber: number; sessionIndex: number } {
  return { cycleNumber: 1, sessionIndex: 0 }
}

// ===== SKIP LOGIC =====

/** Prediksi posisi SETELAH skip (tanpa buka sesi).
 *  Skip = tidak menghitung sesi ini → position tetap. */
export function positionAfterSkip(currentIndex: number): number {
  return currentIndex // tidak berubah
}

/** Prediksi posisi SETELAH sesi selesai. */
export function positionAfterSession(currentIndex: number): number {
  return (currentIndex + 1) % CYCLE_LENGTH
}

// ===== 5/3/1 SUGGESTION KEY =====

/** Key preset (leg/push/pull/easy) untuk sesi 5/3/1 berdasarkan sessionIndex.
 *  Ini menggantikan rotasi bebas saat 5/3/1 aktif. */
export function suggestKey531(sessionIndex: number): string {
  return SESSION_TYPES[sessionIndex % CYCLE_LENGTH]
}

/** 5/3/1 sequence untuk ditampilkan di UI (16 sesi). */
export function get531Sequence(): { key: string; label: string; scheme: string }[] {
  return SESSION_TYPES.map((key, i) => ({
    key,
    label: SESSION_LABELS[i],
    scheme: SCHEMES[i]?.label ?? '',
  }))
}
