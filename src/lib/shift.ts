import { parseKey } from './date'
import type { UserSettings } from '../types'

export type ShiftType = 'pagi' | 'sore' | 'malam' | 'libur'

// Pola siklus shift user (dari jadwal resmi Agustus 2026): 3 hari kerja → 1 hari libur,
// rotasi maju Shift 2 (Sore) → Shift 3 (Malam) → Shift 1 (Pagi) → ulang.
// Panjang siklus 12 hari: [Sore Sore Sore L] [Malam Malam Malam L] [Pagi Pagi Pagi L].
const SHIFT_CYCLE_PATTERN: ShiftType[] = [
  'sore', 'sore', 'sore', 'libur',
  'malam', 'malam', 'malam', 'libur',
  'pagi', 'pagi', 'pagi', 'libur',
]

// Tanggal patokan (anchor) — 12 Agustus 2026 = hari ke-1 blok Sore.
// Sesuai bacaan kalender yang dikonfirmasi user: 12–14 Sore · 15 Libur · 16–18 Malam ·
// 19 Libur · dst. (3-on/1-off rotasi maju). Hari ini 14 Ags = Sore, 15 Ags = Libur.
export const DEFAULT_SHIFT_ANCHOR = '2026-08-12'

// Patokan basi yang sudah digantikan — versi lama memakai 15 Ags (fase pola bergeser
// 3 hari, terbukti salah dari bacaan kalender asli). Nilai tersimpan 15 Ags dianggap
// kosong → otomatis kembali ke default baru tanpa perlu reset manual.
const STALE_ANCHORS = new Set(['2026-08-15'])

export function resolveShiftAnchor(stored?: string): string {
  return stored && !STALE_ANCHORS.has(stored) ? stored : DEFAULT_SHIFT_ANCHOR
}

export const SHIFT_LABELS: Record<ShiftType, string> = {
  pagi: 'Pagi',
  sore: 'Sore',
  malam: 'Malam',
  libur: 'Libur',
}

export const SHIFT_TYPES: ShiftType[] = ['pagi', 'sore', 'malam', 'libur']

export const SHIFT_COLORS: Record<ShiftType, string> = {
  pagi: '#fbbf24', // kuning — pagi
  sore: '#60a5fa', // biru — sore
  malam: '#a78bfa', // ungu — malam
  libur: '#6b7280', // abu — libur
}

// Shift pada tanggal tertentu menurut siklus (tanpa override)
export function cycleShiftAt(anchor: string, date: string): ShiftType {
  const diff = Math.round((parseKey(date).getTime() - parseKey(anchor).getTime()) / 86400000)
  return SHIFT_CYCLE_PATTERN[((diff % 12) + 12) % 12] ?? 'pagi'
}

// Shift pada tanggal tertentu: override manual → siklus (dari anchor) → legacy.
export function shiftForDate(date: string, settings: Partial<UserSettings>): ShiftType {
  const ov = settings.shiftOverride?.[date]
  // 'siang' = alias lama untuk 'sore' (sebelum pola shift dikoreksi dari jadwal resmi)
  if (ov === 'pagi' || ov === 'siang' || ov === 'sore' || ov === 'malam' || ov === 'libur') {
    return ov === 'siang' ? 'sore' : ov
  }
  return cycleShiftAt(resolveShiftAnchor(settings.shiftAnchor), date)
}


