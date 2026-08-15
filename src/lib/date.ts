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

// volume helpers
export function volumeOf(sets: { weightKg: number; reps: number; durationSec?: number }[]): number {
  return sets.reduce(
    (acc, s) => acc + s.weightKg * (s.durationSec != null ? s.durationSec / 60 : s.reps),
    0,
  )
}