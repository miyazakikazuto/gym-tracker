import { addDays, parseKey } from './date'
import { presetByName, presetByKey } from './templates'
import type { Session, WorkoutPlan, UserSettings } from '../types'

// Urutan default: mulai dari Leg, lalu Easy (recovery), Push, Pull.
// User bisa mengubah urutan di Pengaturan.
export const DEFAULT_ROTATION = ['leg', 'easy', 'push', 'pull']

export interface RotationState {
  rotation: string[]
  weeklyTarget: number
  shift: UserSettings['shift']
}

export function rotationOf(settings: Partial<UserSettings>): RotationState {
  return {
    rotation: settings.rotation && settings.rotation.length > 0 ? settings.rotation : DEFAULT_ROTATION,
    weeklyTarget: settings.weeklyTarget ?? 4,
    shift: settings.shift ?? null,
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

// Jumlah sesi selesai dalam 7 hari berjalan (hari ini + 6 hari ke belakang)
export function freq7(sessions: Session[], today: string): number {
  const start = addDays(today, -6)
  return sessions.filter((s) => s.endedAt !== null && s.date >= start && s.date <= today).length
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

// Saran final: shift malam → ringankan ke 'easy' (bisa ditimpa manual oleh user)
export function suggestKey(
  settings: Partial<UserSettings>,
  sessions: Session[],
): { key: string; isNightLight: boolean } {
  const { shift } = rotationOf(settings)
  const key = nextRotationKey(settings, sessions)
  const isNightLight = shift === 'malam' && key !== 'easy'
  return { key: isNightLight ? 'easy' : key, isNightLight }
}

// Plan milik user untuk suatu key preset (dicocokkan lewat nama preset)
export function planForKey(plans: WorkoutPlan[], key: string): WorkoutPlan | undefined {
  const preset = presetByKey(key)
  if (!preset) return undefined
  return plans.find((p) => p.name === preset.name)
}
