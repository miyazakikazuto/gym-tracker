import { describe, it, expect } from 'vitest'
import { deltaKg } from './weightDelta'
import type { Bodyweight } from '../types'

function bw(date: string, kg: number): Bodyweight {
  return { id: date, date, kg }
}

// Delta = selisih entry terlama dalam jendela [today-N, today] vs latest.
// today = 2026-08-31.
const TODAY = '2026-08-31'

describe('deltaKg (window logic)', () => {
  it('Δ7: tidak ada entry dalam window (08-24 tepat di batas) → null', () => {
    // window (08-24, 08-31]; 08-24 tidak termasuk (tepat di batas)
    const entries = [bw('2026-08-24', 71), bw('2026-08-31', 70)]
    expect(deltaKg(entries, 7, TODAY)).toBe(null)
  })

  it('Δ7: entry 08-25 (6 hari lalu) dipakai, bukan 08-24', () => {
    // window [08-24, 08-31]; oldest in window = 08-25 (53.4), bukan 08-24 (52.9)
    // Seperti kasus user: 54 - 53.4 = 0.6
    const entries = [bw('2026-08-24', 52.9), bw('2026-08-25', 53.4), bw('2026-08-31', 54)]
    expect(deltaKg(entries, 7, TODAY)).toBe(0.6)
  })

  it('Δ30: entry terawal dalam window (08-01, 08-31]', () => {
    // latest=08-28 (bukan today); window (08-01, 08-31]; oldest > 08-01 = 08-20 (71)
    const entries = [bw('2026-07-25', 72), bw('2026-08-20', 71), bw('2026-08-28', 70.5)]
    expect(deltaKg(entries, 30, TODAY)).toBe(-0.5)
  })

  it('Δ30: ada entry dalam window', () => {
    // Δ30 window (08-01, 08-31]; 08-05 > 08-01 ✓; delta = 70.5 - 71 = -0.5
    const entries = [bw('2026-08-05', 71), bw('2026-08-28', 70.5)]
    expect(deltaKg(entries, 30, TODAY)).toBe(-0.5)
  })

  it('hanya 1 entri → null (butuh >=2)', () => {
    expect(deltaKg([bw('2026-08-28', 70)], 7, TODAY)).toBe(null)
  })

  it('Δ30: tidak ada entry dalam window → null', () => {
    // window (08-01, 08-31]; 07-20 < 08-01 → tidak ada entry > 08-01
    const entries = [bw('2026-07-20', 73), bw('2026-08-31', 70)]
    expect(deltaKg(entries, 30, TODAY)).toBe(null)
  })

  it('Δ30: entry tepat di batas window → null (tidak termasuk)', () => {
    // window (08-01, 08-31]; 08-01 tidak termasuk (> bukan >=)
    const entries = [bw('2026-08-01', 75), bw('2026-08-31', 70)]
    expect(deltaKg(entries, 30, TODAY)).toBe(null)
  })
})