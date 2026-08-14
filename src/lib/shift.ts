import { parseKey, dateKey } from './date'
import type { UserSettings } from '../types'

export type ShiftType = 'pagi' | 'siang' | 'malam' | 'libur'

// Pola siklus shift user: 3 hari kerja → 1 hari libur, bergilir Pagi → Siang → Malam → ulang.
// Panjang siklus 12 hari: [P P P L] [S S S L] [M M M L].
export const SHIFT_CYCLE_PATTERN: ShiftType[] = [
  'pagi', 'pagi', 'pagi', 'libur',
  'siang', 'siang', 'siang', 'libur',
  'malam', 'malam', 'malam', 'libur',
]

// Tanggal patokan (anchor) — 12 Agustus 2026 = hari ke-1 blok Pagi (resmi dari user).
export const DEFAULT_SHIFT_ANCHOR = '2026-08-12'

export const SHIFT_LABELS: Record<ShiftType, string> = {
  pagi: 'Pagi',
  siang: 'Siang',
  malam: 'Malam',
  libur: 'Libur',
}

export const SHIFT_TYPES: ShiftType[] = ['pagi', 'siang', 'malam', 'libur']

// Shift pada tanggal tertentu menurut siklus (tanpa override)
export function cycleShiftAt(anchor: string, date: string): ShiftType {
  const diff = Math.round((parseKey(date).getTime() - parseKey(anchor).getTime()) / 86400000)
  return SHIFT_CYCLE_PATTERN[((diff % 12) + 12) % 12] ?? 'pagi'
}

// Shift pada tanggal tertentu: override manual → siklus (dari anchor) → legacy.
export function shiftForDate(date: string, settings: Partial<UserSettings>): ShiftType {
  const ov = settings.shiftOverride?.[date]
  if (ov === 'pagi' || ov === 'siang' || ov === 'malam' || ov === 'libur') return ov
  return cycleShiftAt(settings.shiftAnchor || DEFAULT_SHIFT_ANCHOR, date)
}

// Hitung patokan mundur: geser anchor seminimal mungkin agar shift(today) = shift yang dipilih.
// Dipakai untuk "set dari shift hari ini" — user cukup menandai shift-nya, app yang menghitung tanggal patokan.
export function alignAnchor(anchor: string, today: string, shift: ShiftType): string {
  const base = parseKey(anchor).getTime()
  for (let delta = 0; delta <= 12; delta++) {
    for (const d of delta === 0 ? [0] : [delta, -delta]) {
      const cand = dateKey(new Date(base + d * 86400000))
      if (cycleShiftAt(cand, today) === shift) return cand
    }
  }
  return anchor
}

// Saran waktu terbaik berlatih per shift.
export function shiftAdvice(shift: ShiftType): string {
  switch (shift) {
    case 'pagi':
      return 'Latihan sore setelah kerja (±15–17) — badan sudah hangat, tidur malam tetap terjaga.'
    case 'siang':
      return 'Latihan pagi sebelum shift (±08–10) — jendela terbaik, tidak bentrok kerja.'
    case 'malam':
      return 'Latihan sebelum shift atau setelah bangun tidur — jangan langsung setelah lembur. Disarankan sesi ringan (Easy).'
    case 'libur':
      return 'Hari bebas — waktu terbaik untuk sesi berat atau recovery penuh.'
  }
}
