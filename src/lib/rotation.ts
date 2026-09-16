import { parseKey, todayKey } from './date'
import { presetByName, presetByLooseName, presetByKey } from './templates'
import { resolveShiftAnchor, type ShiftType } from './shift'
import { isCountedSession } from './helpers'
import type { Session, WorkoutPlan, UserSettings } from '../types'
// Urutan default: mulai dari Leg, lalu Easy (recovery), Push, Pull.
// User bisa mengubah urutan di Pengaturan.
const DEFAULT_ROTATION = ['leg', 'easy', 'push', 'pull']

export interface RotationState {
  rotation: string[]
  anchor: string
}

export function rotationOf(settings: Partial<UserSettings>): RotationState {
  return {
    rotation: settings.rotation && settings.rotation.length > 0 ? settings.rotation : DEFAULT_ROTATION,
    anchor: resolveShiftAnchor(settings.shiftAnchor),
  }
}

// Sesi yang tidak dihitung sebagai latihan gym: Rest Day, Cardio, Skip lama
// ("Skip — …") dan sesi tambahan manual. Disamakan dengan filter progression
// agar cycle Wendler dan rotasi tidak divergen — sumber tunggal di helpers.isCountedSession.
function isNonCountingSession(s: Session): boolean {
  return !isCountedSession(s)
}

function isRestSession(s: Session): boolean {
  return isNonCountingSession(s)
}

export function lastFinishedSession(sessions: Session[]): Session | null {
  let best: Session | null = null
  for (const s of sessions) {
    if (s.endedAt === null || isRestSession(s)) continue
    if (!best || s.date > best.date || (s.date === best.date && s.startedAt > best.startedAt)) best = s
  }
  return best
}

// Hari sejak sesi terakhir selesai (0 = hari ini, null = belum pernah)
export function daysSinceLast(sessions: Session[], today: string): number | null {
  const last = lastFinishedSession(sessions)
  if (!last) return null
  const diff = parseKey(today).getTime() - parseKey(last.date).getTime()
  return Math.max(0, Math.round(diff / 86400000))
}

// Key berikutnya dalam rotasi — setelah sesi terakhir yang selesai
function nextRotationKey(settings: Partial<UserSettings>, sessions: Session[]): string {
  const { rotation } = rotationOf(settings)
  if (rotation.length === 0) return DEFAULT_ROTATION[0]
  const last = lastFinishedSession(sessions)
  if (!last) return rotation[0]
  const lastKey = (presetByLooseName(last.planName) ?? presetByName(last.planName))?.key
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

// Mode bebas Week-3: Pull/Push/Leg bebas urut, 3/3 baru lanjut, duplicate=1, 5/3/1 wave tetap urut
export const FREE_WEEK_KEYS = ['pull', 'push', 'leg'] as const

export function freeNextKey(doneKeys: Set<string>): string | null {
  for (const k of FREE_WEEK_KEYS) if (!doneKeys.has(k)) return k
  return null
}

export function weekProgressFreeOrder(
  sessions: Session[],
  _excludedTypes: Set<string>,
  skippedSessions: number,
  settings?: Partial<UserSettings>,
): { cycle: number; sessionIndex: number; doneKeys: Set<string>; isWeekComplete: boolean; progress: string } {
  const WEEK = 3
  let countedSessions: Session[]
  if (settings?.freeOrderSince || settings?.freeOrderOffset != null) {
    const since = settings?.freeOrderSince
    countedSessions = sessions
      .filter((s) => isCountedSession(s) && (!since || s.date >= since))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt)
  } else {
    const today = todayKey()
    countedSessions = sessions
      .filter((s) => isCountedSession(s) && s.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt)
  }
  // Iterative walk: kumpulkan 3 unique per Week (duplicate=1, max 6 scan = 3 unique + 3 duplicate)
  // biar Leg 2× tetap 1/3, tidak loncat Week-2 0/3 prematur
  let pos = 0
  let cycle = 1
  let cur = new Set<string>()
  while (pos < countedSessions.length) {
    cur = new Set<string>()
    let scanned = 0
    while (pos < countedSessions.length && cur.size < 3 && scanned < 6) {
      const k = (presetByLooseName(countedSessions[pos].planName) ?? presetByName(countedSessions[pos].planName))?.key
      if (k && (FREE_WEEK_KEYS as readonly string[]).includes(k)) cur.add(k)
      pos++
      scanned++
      if (cur.size === 3) break
    }
    if (cur.size === 3) {
      if (pos < countedSessions.length) cycle++
      else break
    } else break
  }
  const doneKeys = cur
  const total = countedSessions.length + (skippedSessions ?? 0)
  return {
    cycle,
    sessionIndex: total % WEEK,
    doneKeys,
    isWeekComplete: doneKeys.size === 3,
    progress: `${doneKeys.size}/3`,
  }
}
