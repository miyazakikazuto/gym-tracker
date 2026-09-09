// Mode Rehab — untuk cedera / pemulihan (mis. tangan kiri rest, lutut kanan patellar).
// Saat settings.rehabMode aktif: 5/3/1 & Training Max DIMATIKAN, saran harian
// mengikuti REHAB_CYCLE di bawah (dihitung dari jumlah sesi selesai, sama
// seperti progression.computePosition tapi tanpa persentase TM).
//
// Preskripsi isometrik default (disepakati user): 3 x 30 detik hold lutut 60°,
// rest 60-90 detik antar set, 2-3x/minggu. Standar riset (Rio 2015, van Ark 2016)
// memakai 5x45s @70-80% MVIC — terlalu berat untuk fase awal, jadi default
// diturunkan ke 3x30s dan bisa dinaikkan bertahap bila nyeri <=3.

import { isRest } from './templates'
import type { Session } from '../types'

// 8 sesi = 2 minggu @4x/minggu: iso → dinamik ringan → upper kanan → easy/cardio
export const REHAB_CYCLE = [
  'leg-iso',
  'leg-light',
  'upper-r',
  'easy',
  'leg-iso',
  'leg-light',
  'upper-r',
  'cardio',
] as const

export type RehabKey = (typeof REHAB_CYCLE)[number]

export const REHAB_CYCLE_LENGTH = REHAB_CYCLE.length

// Isometrik quad lutut 60° — default 3x30s (bisa naik ke 5x45s bertahap)
export const REHAB_ISO_SETS = 3
export const REHAB_ISO_HOLD_SEC = 30
export const REHAB_ISO_REST_SEC = 90

// Stop rule: nyeri/panas >5/10 → hentikan gerakan itu, catat di note sesi
export const REHAB_PAIN_STOP = 5

export function shouldStopRehabSet(pain0to10: number): boolean {
  return pain0to10 > REHAB_PAIN_STOP
}

// Posisi rehab dari jumlah sesi selesai (tanpa skipped — rehab jalan pelan,
// skip tidak menambah hitungan agar tidak lompat).
// Beda dari progression: sesi Cardio DIHITUNG (cardio bagian dari siklus rehab),
// yang dikecualikan hanya: belum selesai, extra, dan Rest Day.
export function rehabPosition(sessions: Session[]): { sessionIndex: number; totalCompleted: number } {
  let completed = 0
  for (const s of sessions) {
    if (s.endedAt === null || s.isExtra || isRest(s.planName)) continue
    completed++
  }
  return { sessionIndex: completed % REHAB_CYCLE_LENGTH, totalCompleted: completed }
}

export function rehabKeyAt(index: number): RehabKey {
  return REHAB_CYCLE[index % REHAB_CYCLE_LENGTH]
}

export function rehabSuggestKey(sessions: Session[]): RehabKey {
  return rehabKeyAt(rehabPosition(sessions).sessionIndex)
}

// Label stiker rehab — prefix R biar beda dari cycle 5/3/1 [C..]
export function rehabLabel(index: number): string {
  const round = Math.floor(index / REHAB_CYCLE_LENGTH) + 1
  return `[R${round}-S${String((index % REHAB_CYCLE_LENGTH) + 1).padStart(2, '0')}]`
}

export function rehabFullLabel(index: number, planName: string): string {
  return `${rehabLabel(index)} ${planName}`
}
