// Semua operasi tanggal pakai WIB (UTC+7)
const WIB_OFFSET = 7 * 60 * 60 * 1000

export function dateKey(ts: number | Date): string {
  const d = new Date(ts)
  return new Date(d.getTime() + WIB_OFFSET).toISOString().slice(0, 10)
}

export function todayKey(): string {
  return dateKey(Date.now())
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) - WIB_OFFSET)
}

export function dayOfWeek(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function formatHM(ts: number | null): string {
  if (!ts) return '—'
  const d = new Date(ts + WIB_OFFSET)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key)
  return dateKey(new Date(d.getTime() + n * 86400000))
}

export function weekStart(key: string): string {
  const dow = dayOfWeek(key)
  return addDays(key, -dow)
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function formatDMYWIB(key: string): string {
  const [y, m, d] = key.split('-')
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`
}

// Parse input tanggal gaya app "DD/MM/YYYY" (terima - . / spasi sebagai pemisah)
// → key YYYY-MM-DD, atau null bila tidak valid (tgl/bln di luar jangkauan,
// Februari 29 non-kabisat, tahun < 2000 atau > 2100).
// Dipakai form yang tidak bisa mengandalkan popup date bawaan browser.
export function parseDMY(raw: string): string | null {
  const parts = raw.trim().split(/[\s./-]+/).filter(Boolean)
  if (parts.length !== 3) return null
  const [d, m, y] = parts.map(Number)
  if (![d, m, y].every((n) => Number.isInteger(n))) return null
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  if (d > lastDay) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// Key YYYY-MM-DD → teks input "DD/MM/YYYY" (kebalikan parseDMY).
export function formatDMYInput(key: string): string {
  const [y, m, d] = key.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

// volume helpers
export function volumeOf(sets: { weightKg: number; reps: number; durationSec?: number }[]): number {
  return sets.reduce(
    (acc, s) => acc + s.weightKg * (s.durationSec != null ? s.durationSec / 60 : s.reps),
    0,
  )
}