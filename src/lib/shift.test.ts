import { describe, it, expect } from 'vitest'
import { cycleShiftAt, resolveShiftAnchor, shiftForDate, DEFAULT_SHIFT_ANCHOR, SHIFT_LABELS } from './shift'

describe('resolveShiftAnchor', () => {
  it('undefined → default 2026-08-12', () => {
    expect(resolveShiftAnchor(undefined)).toBe(DEFAULT_SHIFT_ANCHOR)
    expect(resolveShiftAnchor('')).toBe(DEFAULT_SHIFT_ANCHOR)
  })
  it('stale anchor 2026-08-15 → default', () => {
    expect(resolveShiftAnchor('2026-08-15')).toBe(DEFAULT_SHIFT_ANCHOR)
  })
  it('valid anchor dipertahankan', () => {
    expect(resolveShiftAnchor('2026-08-12')).toBe('2026-08-12')
    expect(resolveShiftAnchor('2026-09-01')).toBe('2026-09-01')
  })
})

describe('cycleShiftAt 12-day pattern dari 2026-08-12', () => {
  it('anchor Day 0 = sore', () => {
    expect(cycleShiftAt('2026-08-12', '2026-08-12')).toBe('sore')
  })
  it('3 sore → libur → 3 malam → libur → 3 pagi → libur', () => {
    const seq = []
    for (let i = 0; i < 12; i++) {
      const date = `2026-08-${String(12 + i).padStart(2, '0')}`
      seq.push(cycleShiftAt('2026-08-12', date))
    }
    expect(seq).toEqual(['sore','sore','sore','libur','malam','malam','malam','libur','pagi','pagi','pagi','libur'])
  })
  it('wrap siklus: hari 12 = hari 0 (sore)', () => {
    expect(cycleShiftAt('2026-08-12', '2026-08-24')).toBe('sore')
  })
  it('tanggal sebelum anchor wrap negatif', () => {
    // 2026-08-11 = libur (satu hari sebelum anchor sore)
    expect(cycleShiftAt('2026-08-12', '2026-08-11')).toBe('libur')
  })
  it('sesuai kalender: 2026-08-14 sore, 2026-08-15 libur, 2026-08-16 malam', () => {
    expect(cycleShiftAt('2026-08-12', '2026-08-14')).toBe('sore')
    expect(cycleShiftAt('2026-08-12', '2026-08-15')).toBe('libur')
    expect(cycleShiftAt('2026-08-12', '2026-08-16')).toBe('malam')
  })
})

describe('shiftForDate override', () => {
  it('override menang atas siklus', () => {
    expect(shiftForDate('2026-08-12', { shiftOverride: { '2026-08-12': 'pagi' } })).toBe('pagi')
  })
  it('alias siang → sore', () => {
    expect(shiftForDate('2026-08-12', { shiftOverride: { '2026-08-12': 'siang' as any } })).toBe('sore')
  })
  it('tanpa override → siklus', () => {
    expect(shiftForDate('2026-08-12', {})).toBe('sore')
  })
  it('override tanggal lain tidak ganggu tanggal target', () => {
    expect(shiftForDate('2026-08-12', { shiftOverride: { '2026-08-13': 'malam' } })).toBe('sore')
  })
  it('override invalid diabaikan → fallback siklus', () => {
    expect(shiftForDate('2026-08-12', { shiftOverride: { '2026-08-12': 'invalid' as any } })).toBe('sore')
  })
})

describe('SHIFT_LABELS', () => {
  it('label konsisten', () => {
    expect(SHIFT_LABELS.pagi).toBe('Pagi')
    expect(SHIFT_LABELS.sore).toBe('Sore')
    expect(SHIFT_LABELS.malam).toBe('Malam')
    expect(SHIFT_LABELS.libur).toBe('Libur')
  })
})
