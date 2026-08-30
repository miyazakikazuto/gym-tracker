import { describe, it, expect } from 'vitest'
import { dateKey, parseKey, addDays, weekStart, formatDMYWIB, volumeOf, MONTHS } from './date'

describe('dateKey / parseKey round-trip WIB', () => {
  it('round-trip', () => {
    const key = '2026-08-15'
    expect(dateKey(parseKey(key))).toBe(key)
    expect(dateKey(parseKey('2026-01-01'))).toBe('2026-01-01')
  })
  it('addDays', () => {
    expect(addDays('2026-08-12', 1)).toBe('2026-08-13')
    expect(addDays('2026-08-12', -1)).toBe('2026-08-11')
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
  it('addDays lintas tahun', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
  })
})

describe('weekStart', () => {
  it('Minggu sebagai awal minggu', () => {
    // 2026-08-12 adalah Rabu → weekStart harus Minggu 2026-08-09
    expect(weekStart('2026-08-12')).toBe('2026-08-09')
    expect(weekStart('2026-08-09')).toBe('2026-08-09')
    expect(weekStart('2026-08-10')).toBe('2026-08-09')
  })
})

describe('formatDMYWIB', () => {
  it('format ke d MMM y Indonesia', () => {
    expect(formatDMYWIB('2026-08-12')).toBe('12 Agu 2026')
    expect(formatDMYWIB('2026-01-05')).toBe('05 Jan 2026')
  })
  it('MONTHS 12 bulan', () => {
    expect(MONTHS).toEqual(['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'])
  })
})

describe('volumeOf', () => {
  it('reps: weight * reps', () => {
    expect(volumeOf([{ weightKg: 50, reps: 5 }])).toBe(250)
    expect(volumeOf([{ weightKg: 50, reps: 5 }, { weightKg: 60, reps: 3 }])).toBe(250+180)
  })
  it('durationSec pakai duration/60 bukan reps', () => {
    // duration 60 detik = 1 menit → volume = weight * 1
    expect(volumeOf([{ weightKg: 20, reps: 99, durationSec: 60 }])).toBe(20)
    expect(volumeOf([{ weightKg: 20, reps: 10, durationSec: 120 }])).toBe(40)
  })
  it('reps dipakai bila durationSec null/undefined', () => {
    expect(volumeOf([{ weightKg: 10, reps: 10 }])).toBe(100)
  })
  it('0 sets → 0', () => {
    expect(volumeOf([])).toBe(0)
  })
})
