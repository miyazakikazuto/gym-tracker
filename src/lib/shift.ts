import { parseKey, dateKey } from './date'
import type { UserSettings } from '../types'

export type ShiftType = 'pagi' | 'sore' | 'malam' | 'libur'

// Pola siklus shift user (dari jadwal resmi Agustus 2026): 3 hari kerja → 1 hari libur,
// rotasi maju Shift 2 (Sore) → Shift 3 (Malam) → Shift 1 (Pagi) → ulang.
// Panjang siklus 12 hari: [Sore Sore Sore L] [Malam Malam Malam L] [Pagi Pagi Pagi L].
export const SHIFT_CYCLE_PATTERN: ShiftType[] = [
  'sore', 'sore', 'sore', 'libur',
  'malam', 'malam', 'malam', 'libur',
  'pagi', 'pagi', 'pagi', 'libur',
]

// Tanggal patokan (anchor) — 15 Agustus 2026 = hari ke-1 blok Sore (awal siklus bersih,
// cocok 17/17 hari pada 15–31 Agustus).
export const DEFAULT_SHIFT_ANCHOR = '2026-08-15'

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
    case 'sore':
      return 'Latihan pagi sebelum shift (±08–10) — jendela terbaik, tidak bentrok kerja.'
    case 'malam':
      return 'Latihan sebelum shift atau setelah bangun tidur — jangan langsung setelah lembur. Disarankan sesi ringan (Easy).'
    case 'libur':
      return 'Hari bebas — waktu terbaik untuk sesi berat atau recovery penuh.'
  }
}
