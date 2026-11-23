import { describe, it, expect } from 'vitest'
import { e1rm, e1rmStr, e1rmKg, E1RM_MAX_REPS } from './e1rm'

describe('e1rm (Epley)', () => {
  it('single = beban asli, tanpa inflasi Epley', () => {
    expect(e1rm(100, 1)).toBe(100)
  })

  it('0 rep (set tidak terjadi) = 0, bukan beban', () => {
    expect(e1rm(80, 0)).toBe(0)
    expect(e1rm(80, -3)).toBe(0)
  })
  it('beban tanpa reps tidak bisa jadi PR e1RM', () => {
    // Set yang cuma diisi beban (reps default 0) tidak boleh mengalahkan set nyata
    expect(e1rm(200, 0)).toBeLessThan(e1rm(100, 5))
  })

  it('10 rep', () => {
    expect(e1rm(100, 10)).toBeCloseTo(133.333, 3)
  })

  it('set di atas batas reps tidak diestimasi (0)', () => {
    expect(e1rm(60, 30)).toBe(0)
    expect(e1rm(50, 20)).toBe(0)
    expect(e1rm(100, E1RM_MAX_REPS + 1)).toBe(0)
  })

  it('tepat di batas masih dihitung', () => {
    expect(e1rm(100, E1RM_MAX_REPS)).toBeCloseTo(140, 5)
  })

  it('beban tidak valid = 0', () => {
    expect(e1rm(0, 5)).toBe(0)
    expect(e1rm(-10, 5)).toBe(0)
  })

  it('set 60 kg × 30 rep tidak lagi mengalahkan 100 kg × 5 rep', () => {
    expect(e1rm(60, 30)).toBeLessThan(e1rm(100, 5))
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
    expect(e1rmKg(100, 1)).toBe('100') // single = beban asli
    expect(e1rmKg(60, 0)).toBe('0') // reps 0 = set tidak terjadi
    expect(e1rmKg(100, 8)).toBe('126.5') // 126.666 → round(253.33)=253 → 126.5
    expect(e1rmKg(60, 30)).toBe('0') // di luar rentang valid
  })
})
describe('e1rm edge intervals', () => {
  it('20 rep di luar batas → 0', () => {
    expect(e1rm(50, 20)).toBe(0)
  })
  it('5 rep', () => {
    expect(e1rm(80, 5)).toBeCloseTo(93.333, 2)
  })
  it('koma formatting via e1rmKg', () => {
    expect(e1rmKg(100, 5)).toBe('116.5')
  })
})
