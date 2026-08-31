import { describe, it, expect } from 'vitest'
import { deltaKg } from './weightDelta'
import type { Bodyweight } from '../types'

function bw(date: string, kg: number): Bodyweight {
  return { id: date, date, kg }
}

// Anchor = today (jendela kalender "N hari terakhir"), bukan tanggal entry terakhir.
// today pada kasus di bawah diambil 2026-08-31 supaya konsisten.
const TODAY = '2026-08-31'

describe('deltaKg (anchor today)', () => {
  it('delta7: latest 08-31 70 vs 08-24 71 (persis 7 hari lalu) → -1', () => {
    const entries = [bw('2026-08-24', 71), bw('2026-08-31', 70)]
    expect(deltaKg(entries, 7, TODAY)).toBe(-1)
  })

  it('entri terakhir bukan today — anchor tetap today', () => {
    // latest = 08-28 (bukan today). Δ30 target = 08-01; entri ≤08-01 ketemu → 07-25.
    const entries = [bw('2026-07-25', 72), bw('2026-08-20', 71), bw('2026-08-28', 70.5)]
    expect(deltaKg(entries, 30, TODAY)).toBe(-1.5)
  })

  it('prev = entri terdekat ≤ target, bukan yang persis N hari', () => {
    // Δ7 target = 08-24; entri 08-22 (2 hari lebih tua) dipakai → 70.5-71 = -0.5
    const entries = [bw('2026-08-22', 71), bw('2026-08-28', 70.5)]
    expect(deltaKg(entries, 7, TODAY)).toBe(-0.5)
  })

  it('tidak ada prev ≤ target → null (data belum cukup tua)', () => {
    // Δ30 target = 08-01, entri terawal 08-05 → null
    const entries = [bw('2026-08-05', 71), bw('2026-08-28', 70.5)]
    expect(deltaKg(entries, 30, TODAY)).toBe(null)
  })

  it('hanya 1 entri → null (butuh >=2)', () => {
    expect(deltaKg([bw('2026-08-28', 70)], 7, TODAY)).toBe(null)
  })

  it('delta30 dengan data >30 hari terpisah jauh', () => {
    const entries = [bw('2026-07-20', 73), bw('2026-08-31', 70)]
    // Δ30 target = 08-01 → prev 07-20 (mendekati, ≤ target) → -3
    expect(deltaKg(entries, 30, TODAY)).toBe(-3)
  })
})