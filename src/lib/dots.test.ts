import { describe, it, expect } from 'vitest'
import { dotsScore, fmtDots, dotsLevel } from './dots'

describe('dotsScore clamp', () => {
  it('BW di bawah 40 dijepit ke 40 (sama dengan 40)', () => {
    expect(dotsScore(300, 30)).toBe(dotsScore(300, 40))
  })
  it('BW di atas 210 dijepit ke 210 (sama dengan 210)', () => {
    expect(dotsScore(300, 250)).toBe(dotsScore(300, 210))
  })
  it('score naik bila total naik pada BW sama', () => {
    expect(dotsScore(400, 80)).toBeGreaterThan(dotsScore(300, 80))
  })
})

describe('fmtDots', () => {
  it('bulat tanpa desimal', () => {
    expect(fmtDots(300)).toBe('300')
  })
  it('satu desimal', () => {
    expect(fmtDots(300.55)).toBe('300.6')
    expect(fmtDots(300.04)).toBe('300')
  })
})

describe('dotsLevel', () => {
  it('≤0 atau NaN → null', () => {
    expect(dotsLevel(0)).toBeNull()
    expect(dotsLevel(-10)).toBeNull()
    expect(dotsLevel(NaN)).toBeNull()
  })
  it('bands: Pemula <250, Novis 250, Menengah 300, Lanjut 350, Elit 400', () => {
    expect(dotsLevel(200)?.label).toBe('Pemula')
    expect(dotsLevel(249)?.label).toBe('Pemula')
    expect(dotsLevel(250)?.label).toBe('Novis')
    expect(dotsLevel(299)?.label).toBe('Novis')
    expect(dotsLevel(300)?.label).toBe('Menengah')
    expect(dotsLevel(349)?.label).toBe('Menengah')
    expect(dotsLevel(350)?.label).toBe('Lanjut')
    expect(dotsLevel(399)?.label).toBe('Lanjut')
    expect(dotsLevel(400)?.label).toBe('Elit')
    expect(dotsLevel(500)?.label).toBe('Elit')
  })
  it('warna sesuai level', () => {
    expect(dotsLevel(200)?.color).toBe('var(--muted)')
    expect(dotsLevel(260)?.color).toBe('#4ade80')
    expect(dotsLevel(310)?.color).toBe('#60a5fa')
    expect(dotsLevel(360)?.color).toBe('#a78bfa')
    expect(dotsLevel(410)?.color).toBe('#fbbf24')
  })
})
