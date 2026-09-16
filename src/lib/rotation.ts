import { parseKey } from './date'
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

export function weekProgressFreeOrder(
  sessions: Session[],
  _excludedTypes: Set<string>,
  skippedSessions: number,
  settings?: Partial<UserSettings>,
): { cycle: number; sessionIndex: number; doneKeys: Set<string>; isWeekComplete: boolean; progress: string } {
  const WEEK = 3
  // Jangkar: kalau freeOrderSince/Offset ada → hitung dari sana (Week-1 langsung), fallback ke global (biar nggak crash)
  // Juga handle kasus sudah terlanjur Week-13 (tanpa jangkar) → paksa balik ke Week-1 via offset implisit
  let total: number
  let countedSessions: Session[]
  if (settings?.freeOrderSince || settings?.freeOrderOffset != null) {
    const offset = settings?.freeOrderOffset ?? 0
    const since = settings?.freeOrderSince
    let countedAll = 0
    for (const s of sessions) if (isCountedSession(s)) countedAll++
    total = Math.max(0, countedAll - offset + (skippedSessions ?? 0))
    countedSessions = sessions
      .filter((s) => isCountedSession(s) && (!since || s.date >= since))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt)
  } else {
    // Fallback tanpa jangkar: hitung dari sesi hari ini saja biar Leg 16 Sep via Riwayat langsung 1/3
    const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
    countedSessions = sessions
      .filter((s) => isCountedSession(s) && s.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt)
    // total = unique counted hari ini + skipped, tapi weekProgress pakai total untuk cycle; pakai doneKeys size untuk progress yang jujur
    // Supaya cycle tidak loncat, total = countedSessions length (filtered today) — cukup untuk 0/3→1/3 hari ini
    total = countedSessions.length + (skippedSessions ?? 0)
  }
  const cycle = Math.floor(total / WEEK) + 1
  const weekStart = (cycle - 1) * WEEK
  const doneKeys = new Set<string>()
  const uniqueNeeded = 3
  for (let i = weekStart; i < countedSessions.length && doneKeys.size < uniqueNeeded; i++) {
    const k = (presetByLooseName(countedSessions[i].planName) ?? presetByName(countedSessions[i].planName))?.key
    if (!k || !(FREE_WEEK_KEYS as readonly string[]).includes(k)) continue
    doneKeys.add(k)
    if (doneKeys.size === 3) break
    if (i - weekStart >= 5) break
  }
  // Kalau fallback total 0 tapi ada countedSessions kosong → doneKeys 0/3 Week-1 (benar)
  // Kalau fallback tapi ada sesi baru setelah ON tanpa jangkar, countedSessions akan kosong → tetap 0/3, akan terisi setelah jangkar diset
  return {
    cycle,
    sessionIndex: total % WEEK,
    doneKeys,
    isWeekComplete: doneKeys.size === 3,
    progress: `${doneKeys.size}/3`,
  }
}
