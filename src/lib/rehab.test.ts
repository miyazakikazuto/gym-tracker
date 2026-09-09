import { describe, it, expect } from 'vitest'
import {
  REHAB_CYCLE,
  REHAB_CYCLE_LENGTH,
  REHAB_ISO_SETS,
  REHAB_ISO_HOLD_SEC,
  REHAB_PAIN_STOP,
  REHAB_WAVES,
  shouldStopRehabSet,
  rehabPosition,
  rehabKeyAt,
  rehabSuggestKey,
  rehabFullLabel,
  rehabWaveAt,
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
  it('panjang 16 sesi (1 bulan), iso default 3x30s, stop-rule nyeri >5', () => {
    expect(REHAB_CYCLE_LENGTH).toBe(16)
    expect(REHAB_CYCLE).toHaveLength(16)
    expect(REHAB_ISO_SETS).toBe(3)
    expect(REHAB_ISO_HOLD_SEC).toBe(30)
    expect(REHAB_PAIN_STOP).toBe(5)
  })
  it('8 pertama = cycle lama (stiker lama tetap valid)', () => {
    expect([...REHAB_CYCLE.slice(0, 8)]).toEqual([
      'leg-iso', 'leg-light', 'upper-r', 'easy',
      'leg-iso', 'leg-light', 'upper-r', 'cardio',
    ])
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
  it('wrap-around setelah 16 sesi', () => {
    const sessions = Array.from({ length: 16 }, (_, i) => sess({ id: `s${i}`, planName: 'Leg Rehab Iso' }))
    expect(rehabPosition(sessions).sessionIndex).toBe(0)
    expect(rehabSuggestKey(sessions)).toBe('leg-iso')
  })
})

describe('rehabKeyAt / rehabFullLabel', () => {
  it('keyAt wrap', () => {
    expect(rehabKeyAt(0)).toBe('leg-iso')
    expect(rehabKeyAt(16)).toBe('leg-iso')
  })
  it('label prefix R + wave (beda dari cycle 5/3/1 [C..])', () => {
    expect(rehabFullLabel(0, 'Leg Rehab Iso')).toBe('[R1-S01] Leg Rehab Iso — W1')
    expect(rehabFullLabel(4, 'Leg Rehab Iso')).toBe('[R1-S05] Leg Rehab Iso — W2')
    expect(rehabFullLabel(16, 'Leg Rehab Iso')).toBe('[R2-S01] Leg Rehab Iso — W1')
  })
})

describe('REHAB_WAVES', () => {
  it('4 wave: hold 30→35→40→deload 30', () => {
    expect(REHAB_WAVES.map((w) => w.label)).toEqual(['W1', 'W2', 'W3', 'W4'])
    expect(rehabWaveAt(0).isoHoldSec).toBe(30)
    expect(rehabWaveAt(4).isoHoldSec).toBe(35)
    expect(rehabWaveAt(8).isoHoldSec).toBe(40)
    expect(rehabWaveAt(12).isoHoldSec).toBe(30)
    expect(rehabWaveAt(12).isoSets).toBe(2)
    expect(rehabWaveAt(15).label).toBe('W4')
  })
})
