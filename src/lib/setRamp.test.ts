import { describe, it, expect } from 'vitest'
import { rampWeights } from './setRamp'

describe('rampWeights (awal → puncak)', () => {
  it('1 set = puncak saja', () => {
    expect(rampWeights(50, 70, 1)).toEqual([70])
  })
  it('2 set = awal + puncak, tanpa tengah', () => {
    expect(rampWeights(50, 70, 2)).toEqual([50, 70])
  })
  it('3 set 50 → 70 = [50, 60, 70]', () => {
    expect(rampWeights(50, 70, 3)).toEqual([50, 60, 70])
  })
  it('4 set dibulatkan ke 0,5 kg', () => {
    expect(rampWeights(50, 70, 4)).toEqual([50, 56.5, 63.5, 70])
  })
  it('7 set langkah rata', () => {
    expect(rampWeights(40, 70, 7)).toEqual([40, 45, 50, 55, 60, 65, 70])
  })
  it('jumlah set dijepit 1–7', () => {
    expect(rampWeights(50, 70, 0)).toEqual([70])
    expect(rampWeights(50, 70, 9)).toHaveLength(7)
  })
  it('puncak < awal = ramp turun (drop set)', () => {
    expect(rampWeights(70, 50, 3)).toEqual([70, 60, 50])
  })
  it('beban negatif dijepit ke 0', () => {
    expect(rampWeights(-10, 0, 2)).toEqual([0, 0])
  })
})
