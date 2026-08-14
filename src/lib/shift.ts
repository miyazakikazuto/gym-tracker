import { parseKey } from './date'
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

// Shift pada tanggal tertentu: override manual → siklus (dari anchor) → legacy.
export function shiftForDate(date: string, settings: Partial<UserSettings>): ShiftType {
  const ov = settings.shiftOverride?.[date]
  if (ov === 'pagi' || ov === 'siang' || ov === 'malam' || ov === 'libur') return ov
  const anchor = settings.shiftAnchor || DEFAULT_SHIFT_ANCHOR
  const diff = Math.round((parseKey(date).getTime() - parseKey(anchor).getTime()) / 86400000)
  return SHIFT_CYCLE_PATTERN[((diff % 12) + 12) % 12] ?? 'pagi'
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
