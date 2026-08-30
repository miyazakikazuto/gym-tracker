import { describe, it, expect } from 'vitest'
import { parseDecimal } from './parse'

describe('parseDecimal', () => {
  it('titik', () => { expect(parseDecimal('10.5')).toBe(10.5) })
  it('koma → titik (Indonesia)', () => { expect(parseDecimal('10,5')).toBe(10.5) })
  it('trim spasi', () => { expect(parseDecimal('  12,5  ')).toBe(12.5) })
  it('invalid → null', () => {
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('--')).toBeNull()
  })
  it('empty → 0 (Number empty behaviour)', () => {
    expect(parseDecimal('')).toBe(0)
  })
  it('negatif & 0', () => {
    expect(parseDecimal('-5,5')).toBe(-5.5)
    expect(parseDecimal('0')).toBe(0)
    expect(parseDecimal('0,0')).toBe(0)
  })
})
