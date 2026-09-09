import { describe, it, expect } from 'vitest'
import {
  REHAB_CYCLE,
  REHAB_CYCLE_LENGTH,
  REHAB_ISO_SETS,
  REHAB_ISO_HOLD_SEC,
  REHAB_PAIN_STOP,
  shouldStopRehabSet,
  rehabPosition,
  rehabKeyAt,
  rehabSuggestKey,
  rehabFullLabel,
} from './rehab'
import { presetByKey } from './templates'
import type { Session } from '../types'

function sess(over: Partial<Session> & { id: string }): Session {
  return {
    date: '2026-08-20',
    planId: null,
    planName: 'Leg Rehab Iso',
    note: '',
    startedAt: 1,
    endedAt: 2,
    sets: [],
    ...over,
  }
}

describe('REHAB_CYCLE', () => {
  it('panjang 8 sesi, iso 3x30s, stop-rule nyeri >5', () => {
    expect(REHAB_CYCLE_LENGTH).toBe(8)
    expect(REHAB_CYCLE).toHaveLength(8)
    expect(REHAB_ISO_SETS).toBe(3)
    expect(REHAB_ISO_HOLD_SEC).toBe(30)
    expect(REHAB_PAIN_STOP).toBe(5)
  })
  it('semua key rehab ada preset-nya di templates', () => {
    for (const key of REHAB_CYCLE) {
      expect(presetByKey(key), `preset ${key}`).toBeDefined()
    }
  })
  it('tanpa push/pull bilateral — kiri rest', () => {
    expect(REHAB_CYCLE).not.toContain('push')
    expect(REHAB_CYCLE).not.toContain('pull')
    expect(REHAB_CYCLE).toContain('leg-light') // leg curl tetap ada
    expect(REHAB_CYCLE).toContain('upper-r')
  })
})

describe('shouldStopRehabSet', () => {
  it('nyeri 5 lanjut, 6 stop', () => {
    expect(shouldStopRehabSet(5)).toBe(false)
    expect(shouldStopRehabSet(6)).toBe(true)
  })
})

describe('rehabPosition / rehabSuggestKey', () => {
  it('akun kosong → index 0', () => {
    expect(rehabPosition([])).toEqual({ sessionIndex: 0, totalCompleted: 0 })
    expect(rehabSuggestKey([])).toBe('leg-iso')
  })
  it('sesi extra/rest/belum selesai tidak majuin siklus', () => {
    const sessions = [
      sess({ id: 'a', planName: 'Leg Rehab Iso' }),
      sess({ id: 'b', planName: 'Rest Day' }),
      sess({ id: 'c', planName: 'Extra', isExtra: true }),
      sess({ id: 'd', planName: 'Leg Ringan', endedAt: null }),
    ]
    const pos = rehabPosition(sessions)
    expect(pos.totalCompleted).toBe(1)
    expect(pos.sessionIndex).toBe(1)
  })
  it('cardio DIHITUNG dalam rehab (beda dari 5/3/1)', () => {
    const sessions = [sess({ id: 'a', planName: 'Cardio Day' })]
    expect(rehabPosition(sessions).totalCompleted).toBe(1)
  })
  it('wrap-around setelah 8 sesi', () => {
    const sessions = Array.from({ length: 8 }, (_, i) => sess({ id: `s${i}`, planName: 'Leg Rehab Iso' }))
    expect(rehabPosition(sessions).sessionIndex).toBe(0)
    expect(rehabSuggestKey(sessions)).toBe('leg-iso')
  })
})

describe('rehabKeyAt / rehabFullLabel', () => {
  it('keyAt wrap', () => {
    expect(rehabKeyAt(0)).toBe('leg-iso')
    expect(rehabKeyAt(8)).toBe('leg-iso')
  })
  it('label prefix R biar beda dari cycle 5/3/1 [C..]', () => {
    expect(rehabFullLabel(0, 'Leg Rehab Iso')).toBe('[R1-S01] Leg Rehab Iso')
    expect(rehabFullLabel(8, 'Leg Rehab Iso')).toBe('[R2-S01] Leg Rehab Iso')
  })
})
