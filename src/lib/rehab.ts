// Mode Rehab — untuk cedera / pemulihan (mis. tangan kiri rest, lutut kanan patellar).
// Saat settings.rehabMode aktif: 5/3/1 & Training Max DIMATIKAN, saran harian
// mengikuti REHAB_CYCLE di bawah (dihitung dari jumlah sesi selesai, sama
// seperti progression.computePosition tapi tanpa persentase TM).
//
// Siklus 16 sesi = 1 bulan @4x/minggu, ala Wendler W1-W4: urutan gerakan sama
// tiap minggu, yang naik hanya DOSIS isometrik + volume ringan (bukan % TM).
// Standar riset (Rio 2015, van Ark 2016) memakai 5x45s @70-80% MVIC — terlalu
// berat untuk fase awal, jadi wave disepakati: 3x30s → 3x35s → 3x40s → deload 2x30s.

import { isRest, presetByName } from './templates'
import type { Exercise, Session } from '../types'

// Sesi rehab = berstiker [R..] ATAU pakai preset khusus rehab ATAU berisi
// set isometrik (hold durasi di gerakan non-cardio — mis. leg day yang isinya
// "Isometrik Quad 60°"). Easy/Cardio TANPA stiker [R..] (era lama) tidak
// dihitung — easy/cardio era rehab selalu berstiker [R..] lewat
// createAndOpen/handleCreate.
const REHAB_ONLY_KEYS = new Set(['leg-iso', 'leg-light', 'upper-r'])

export function hasIsoSet(s: Session, exercises: Exercise[]): boolean {
  for (const set of s.sets) {
    if ((set.durationSec ?? 0) <= 0) continue
    const ex = exercises.find((e) => e.id === set.exerciseId)
    if (!ex) continue
    if (ex.muscleGroup === 'Cardio' || ex.category === 'cardio') continue
    return true
  }
  return false
}

export function isRehabSession(s: Session, exercises: Exercise[] = []): boolean {
  if (s.endedAt === null || s.isExtra || isRest(s.planName)) return false
  if (s.cycleLabel?.startsWith('[R')) return true
  if (REHAB_ONLY_KEYS.has(presetByName(s.planName)?.key ?? '')) return true
  return hasIsoSet(s, exercises)
}

// 16 sesi: 8 pertama = cycle lama (stiker [R1-S01..S08] lama tetap valid),
// 8 kedua = pengulangan pola yang sama untuk W3-W4.
export const REHAB_CYCLE = [
  'leg-iso',
  'leg-light',
  'upper-r',
  'easy',
  'leg-iso',
  'leg-light',
  'upper-r',
  'cardio',
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

export interface RehabWave {
  label: string // W1..W4
  name: string // Pondasi / Bangun / Puncak / Deload
  isoSets: number
  isoHoldSec: number
  lightSets: number // set leg-light per gerakan (upper kanan bebas, konstan ringan)
  note: string
}

// Wave per minggu (4 sesi/minggu): dosis iso naik 30→35→40, deload turun 2x30s
export const REHAB_WAVES: RehabWave[] = [
  { label: 'W1', name: 'Pondasi', isoSets: 3, isoHoldSec: 30, lightSets: 2, note: 'adaptasi — semua ringan' },
  { label: 'W2', name: 'Bangun', isoSets: 3, isoHoldSec: 35, lightSets: 3, note: 'tambah 1 set + hold 35 dtk' },
  { label: 'W3', name: 'Puncak', isoSets: 3, isoHoldSec: 40, lightSets: 3, note: 'hold 40 dtk — stop bila nyeri >5' },
  { label: 'W4', name: 'Deload', isoSets: 2, isoHoldSec: 30, lightSets: 2, note: 'volume -50% — lutut disapa, bukan digas' },
]

export function rehabWaveAt(index: number): RehabWave {
  const week = Math.floor((index % REHAB_CYCLE_LENGTH) / 4)
  return REHAB_WAVES[week]
}

// Kompat: default iso = W1 (3x30s). Rest antar set 60-90 dtk.
export const REHAB_ISO_SETS = REHAB_WAVES[0].isoSets
export const REHAB_ISO_HOLD_SEC = REHAB_WAVES[0].isoHoldSec
export const REHAB_ISO_REST_SEC = 90

// Stop rule: nyeri/panas >5/10 → hentikan gerakan itu, catat di note sesi
export const REHAB_PAIN_STOP = 5

export function shouldStopRehabSet(pain0to10: number): boolean {
  return pain0to10 > REHAB_PAIN_STOP
}

// Posisi rehab dari jumlah sesi REHAB selesai (tanpa skipped — rehab jalan pelan,
// skip tidak menambah hitungan agar tidak lompat).
// Hanya sesi rehab yang dihitung (isRehabSession) — sesi era 5/3/1 (Push/Pull/Leg
// tanpa stiker [R..]) tidak ikut, jadi rehab selalu mulai dari R1-S01.
// Easy/Cardio era rehab ikut karena berstiker [R..].
export function rehabPosition(sessions: Session[], exercises: Exercise[] = []): { sessionIndex: number; totalCompleted: number } {
  let completed = 0
  for (const s of sessions) {
    if (!isRehabSession(s, exercises)) continue
    completed++
  }
  return { sessionIndex: completed % REHAB_CYCLE_LENGTH, totalCompleted: completed }
}

export function rehabKeyAt(index: number): RehabKey {
  return REHAB_CYCLE[index % REHAB_CYCLE_LENGTH]
}

export function rehabSuggestKey(sessions: Session[], exercises: Exercise[] = []): RehabKey {
  return rehabKeyAt(rehabPosition(sessions, exercises).sessionIndex)
}

export type RehabCellStatus = 'done' | 'current' | 'todo'

// Status tiap kotak grid program: sel global = round*16 + index.
// done = sudah dilewati, current = posisi sekarang, todo = jadwal ke depan.
export function rehabRound(totalCompleted: number): number {
  return Math.floor(totalCompleted / REHAB_CYCLE_LENGTH) + 1
}

export function rehabCellStatus(totalCompleted: number, cellIndex: number): RehabCellStatus {
  const pos = totalCompleted % REHAB_CYCLE_LENGTH
  const round = Math.floor(totalCompleted / REHAB_CYCLE_LENGTH)
  const cellRound = Math.floor(cellIndex / REHAB_CYCLE_LENGTH)
  if (cellRound < round || (cellRound === round && (cellIndex % REHAB_CYCLE_LENGTH) < pos)) return 'done'
  if (cellRound === round && (cellIndex % REHAB_CYCLE_LENGTH) === pos) return 'current'
  return 'todo'
}

// Label stiker rehab — prefix R biar beda dari cycle 5/3/1 [C..],
// wave W1-W4 nempel kayak scheme 5/3/1 (mis. "[R1-S05] Leg Rehab Iso — W2")
export function rehabLabel(index: number): string {
  const round = Math.floor(index / REHAB_CYCLE_LENGTH) + 1
  return `[R${round}-S${String((index % REHAB_CYCLE_LENGTH) + 1).padStart(2, '0')}]`
}

export function rehabFullLabel(index: number, planName: string): string {
  return `${rehabLabel(index)} ${planName} — ${rehabWaveAt(index).label}`
}
