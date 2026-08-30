import { describe, it, expect } from 'vitest'
import { e1rm, e1rmStr, e1rmKg } from './e1rm'

describe('e1rm (Epley)', () => {
  it('rumus mentah: 1 rep pun tetap ×(1 + reps/30) — sedikit overestimate', () => {
    expect(e1rm(100, 1)).toBeCloseTo(103.333, 3)
  })

  it('0 rep = beban', () => {
    expect(e1rm(80, 0)).toBe(80)
  })

  it('10 rep', () => {
    expect(e1rm(100, 10)).toBeCloseTo(133.333, 3)
  })

  it('0 rep = beban', () => {
    expect(e1rm(80, 0)).toBe(80)
  })
})

describe('e1rmStr formatting', () => {
  it('bulat penuh tanpa desimal', () => {
    expect(e1rmStr(100)).toBe('100')
    expect(e1rmStr(100.2)).toBe('100') // round ke 100.0
  })

  it('pecahan dibulatkan ke 0,5 lalu tampil satu desimal', () => {
    expect(e1rmStr(132.5)).toBe('132.5')
    expect(e1rmStr(132.4)).toBe('132.5') // round(264.8)=265 → 132.5
    expect(e1rmStr(132.2)).toBe('132') // round(264.4)=264 → 132
  })
})

describe('e1rmKg composite', () => {
  it('gabungan rumus + format', () => {
    expect(e1rmKg(100, 1)).toBe('103.5') // 103.333 → round(206.667)=207 → 103.5
    expect(e1rmKg(60, 0)).toBe('60') // 0 rep = beban persis
    expect(e1rmKg(100, 8)).toBe('126.5') // 126.666 → round(253.33)=253 → 126.5
  })
})
describe('e1rm edge intervals', () => {
  it('20 rep', () => {
    expect(e1rm(50, 20)).toBeCloseTo(83.333, 2)
  })
  it('5 rep', () => {
    expect(e1rm(80, 5)).toBeCloseTo(93.333, 2)
  })
  it('koma formatting via e1rmKg', () => {
    expect(e1rmKg(100, 5)).toBe('116.5')
  })
})
