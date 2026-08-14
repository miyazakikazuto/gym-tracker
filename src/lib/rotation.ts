import { addDays, parseKey } from './date'
import { presetByName, presetByKey } from './templates'
import { DEFAULT_SHIFT_ANCHOR, type ShiftType } from './shift'
import type { Session, WorkoutPlan, UserSettings } from '../types'

// Urutan default: mulai dari Leg, lalu Easy (recovery), Push, Pull.
// User bisa mengubah urutan di Pengaturan.
export const DEFAULT_ROTATION = ['leg', 'easy', 'push', 'pull']

export interface RotationState {
  rotation: string[]
  weeklyTarget: number
  shift: UserSettings['shift']
  anchor: string
}

export function rotationOf(settings: Partial<UserSettings>): RotationState {
  return {
    rotation: settings.rotation && settings.rotation.length > 0 ? settings.rotation : DEFAULT_ROTATION,
    weeklyTarget: settings.weeklyTarget ?? 4,
    shift: settings.shift ?? null,
    anchor: settings.shiftAnchor || DEFAULT_SHIFT_ANCHOR,
  }
}

// Sesi yang selesai paling terakhir (tanggal + waktu mulai)
export function lastFinishedSession(sessions: Session[]): Session | null {
  let best: Session | null = null
  for (const s of sessions) {
    if (s.endedAt === null) continue
    if (!best || s.date > best.date || (s.date === best.date && s.startedAt > best.startedAt)) best = s
  }
  return best
}

// Apakah sesi dihitung ke frekuensi? Easy/Rest tidak (latihan ringan) — K2.
export function countsRealSession(s: Session): boolean {
  const k = presetByName(s.planName)?.key
  return k !== 'easy' && k !== 'rest'
}

// Sesi dalam 7 hari berjalan — dihitung yang selesai ATAU masih berjalan (K3).
export function sessionsInWindow(sessions: Session[], today: string): Session[] {
  const start = addDays(today, -6)
  return sessions.filter((s) => s.date >= start && s.date <= today && countsRealSession(s))
}

// Jumlah sesi (non-Easy) dalam 7 hari berjalan
export function freq7(sessions: Session[], today: string): number {
  return sessionsInWindow(sessions, today).length
}

// Frekuensi per kategori dalam 7 hari berjalan (untuk rincian per kategori)
export function freqByCategory(sessions: Session[], today: string): { key: string; count: number }[] {
  const map = new Map<string, number>()
  for (const s of sessionsInWindow(sessions, today)) {
    const k = presetByName(s.planName)?.key
    map.set(k && k !== 'easy' && k !== 'rest' ? k : 'lainnya', (map.get(k && k !== 'easy' && k !== 'rest' ? k : 'lainnya') ?? 0) + 1)
  }
  return [...map.entries()].map(([key, count]) => ({ key, count }))
}

// Hari sejak sesi terakhir selesai (0 = hari ini, null = belum pernah)
export function daysSinceLast(sessions: Session[], today: string): number | null {
  const last = lastFinishedSession(sessions)
  if (!last) return null
  const diff = parseKey(today).getTime() - parseKey(last.date).getTime()
  return Math.max(0, Math.round(diff / 86400000))
}

// Key berikutnya dalam rotasi — setelah sesi terakhir yang selesai
export function nextRotationKey(settings: Partial<UserSettings>, sessions: Session[]): string {
  const { rotation } = rotationOf(settings)
  if (rotation.length === 0) return DEFAULT_ROTATION[0]
  const last = lastFinishedSession(sessions)
  if (!last) return rotation[0]
  const lastKey = presetByName(last.planName)?.key
  if (!lastKey) return rotation[0]
  const idx = rotation.indexOf(lastKey)
  if (idx === -1) return rotation[0]
  return rotation[(idx + 1) % rotation.length]
}

// Saran final: shift malam → ringankan ke 'easy' (bisa ditimpa manual oleh user).
// todayShift dihitung dari siklus shift + override (lihat src/lib/shift.ts).
export function suggestKey(
  settings: Partial<UserSettings>,
  sessions: Session[],
  todayShift?: ShiftType | null,
): { key: string; isNightLight: boolean } {
  const key = nextRotationKey(settings, sessions)
  const isNightLight = todayShift === 'malam' && key !== 'easy'
  return { key: isNightLight ? 'easy' : key, isNightLight }
}

// Plan milik user untuk suatu key preset (dicocokkan lewat nama preset)
export function planForKey(plans: WorkoutPlan[], key: string): WorkoutPlan | undefined {
  const preset = presetByKey(key)
  if (!preset) return undefined
  return plans.find((p) => p.name === preset.name)
}
