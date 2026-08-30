import { describe, it, expect } from 'vitest'
import { deltaKg } from './weightDelta'
import type { Bodyweight } from '../types'

function bw(date: string, kg: number): Bodyweight {
  return { id: date, date, kg }
}

describe('deltaKg (anchor latest)', () => {
  it('sparse: latest 2026-08-27 70.5 vs 2026-08-20 71 → delta7 -0.5', () => {
    const entries = [bw('2026-08-20', 71), bw('2026-08-27', 70.5)]
    expect(deltaKg(entries, 7)).toBe(-0.5)
  })

  it('exact 7 hari: latest 2026-08-30 70 vs 2026-08-23 71 → -1', () => {
    const entries = [bw('2026-08-23', 71), bw('2026-08-30', 70)]
    expect(deltaKg(entries, 7)).toBe(-1)
  })

  it('tidak ada prev dalam jangkauan → null', () => {
    const entries = [bw('2026-08-28', 71), bw('2026-08-30', 70.5)]
    // target latest-7 = 2026-08-23, tidak ada entri <=2026-08-23 selain maybe? 2026-08-28 > target jadi null
    expect(deltaKg(entries, 7)).toBe(null)
  })

  it('sparse 10-hari gap tetap pakai target 7-hari (bukan today-7)', () => {
    // entries: 2026-08-22 71, latest 2026-08-27 70.5 → target=2026-08-20 → tidak ada <=2026-08-20 → null (bukan -0.5)
    // ini kasus C dari repro: bila anchor today akan pick 2026-08-22 (5 hari gap) salah
    const entries = [bw('2026-08-22', 71), bw('2026-08-27', 70.5)]
    expect(deltaKg(entries, 7)).toBe(null)

    // dengan riwayat lebih lama, pick benar:
    const entries2 = [bw('2026-08-20', 71), bw('2026-08-22', 70.8), bw('2026-08-27', 70.5)]
    // target 2026-08-20 → pick 2026-08-20 (exact)
    expect(deltaKg(entries2, 7)).toBe(-0.5)
  })

  it('delta30 sparse', () => {
    const entries = [bw('2026-07-25', 72), bw('2026-08-27', 70.5)]
    // latest-30 = 2026-07-28 → prev <=2026-07-28 adalah 2026-07-25
    expect(deltaKg(entries, 30)).toBe(-1.5)
  })

  it('hanya 1 entri → null (butuh >=2)', () => {
    expect(deltaKg([bw('2026-08-27', 70)], 7)).toBe(null)
  })
})
