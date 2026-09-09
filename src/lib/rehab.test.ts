import { describe, it, expect } from 'vitest'
import {
  REHAB_CYCLE,
  REHAB_CYCLE_LENGTH,
  REHAB_ISO_SETS,
  REHAB_ISO_HOLD_SEC,
  REHAB_PAIN_STOP,
  REHAB_WAVES,
  shouldStopRehabSet,
  hasIsoSet,
  isRehabSession,
  rehabPosition,
  rehabKeyAt,
  rehabSuggestKey,
  rehabFullLabel,
  rehabWaveAt,
  rehabRound,
  rehabCellStatus,
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

describe('hasIsoSet', () => {
  const exs = [
    { id: 'iso1', name: 'Isometrik Quad 60°', muscleGroup: 'Kaki', equipment: 'Machine' },
    { id: 'c1', name: 'Treadmill', muscleGroup: 'Cardio', equipment: 'Bodyweight' },
  ]
  const isoSess = (id: string, planName: string, sets: Session['sets']) =>
    sess({ id, planName, sets })
  it('set hold 30 dtk di gerakan Kaki → true', () => {
    const s = isoSess('a', 'Leg Day', [
      { id: 's1', exerciseId: 'iso1', setNumber: 1, weightKg: 0, reps: 0, durationSec: 30 },
    ])
    expect(hasIsoSet(s, exs)).toBe(true)
    expect(isRehabSession(s, exs)).toBe(true)
  })
  it('set durasi di gerakan Cardio → false', () => {
    const s = isoSess('b', 'Cardio Day', [
      { id: 's1', exerciseId: 'c1', setNumber: 1, weightKg: 0, reps: 0, durationSec: 600 },
    ])
    expect(hasIsoSet(s, exs)).toBe(false)
    expect(isRehabSession(s, exs)).toBe(false)
  })
  it('tanpa exercises → fallback aturan lama (stiker/preset)', () => {
    const s = sess({ id: 'c', planName: 'Leg Day' })
    expect(isRehabSession(s)).toBe(false)
  })
})

describe('isRehabSession', () => {
  it('stiker [R..] dihitung walau preset umum (easy/cardio era rehab)', () => {
    expect(isRehabSession(sess({ id: 'a', planName: 'Easy Day', cycleLabel: '[R1-S04] Easy Day — W1' }))).toBe(true)
  })
  it('preset khusus rehab tanpa stiker tetap dihitung', () => {
    expect(isRehabSession(sess({ id: 'a', planName: 'Leg Rehab Iso' }))).toBe(true)
    expect(isRehabSession(sess({ id: 'b', planName: 'Upper Kanan' }))).toBe(true)
  })
  it('sesi era 5/3/1 (Push/Pull/Leg/Cardio tanpa [R..]) TIDAK dihitung', () => {
    expect(isRehabSession(sess({ id: 'a', planName: 'Pull Day' }))).toBe(false)
    expect(isRehabSession(sess({ id: 'b', planName: 'Cardio Day' }))).toBe(false)
    expect(isRehabSession(sess({ id: 'c', planName: 'Leg Day', cycleLabel: '[C1-S01] Leg Day — 3×5' }))).toBe(false)
  })
})

describe('rehabPosition / rehabSuggestKey', () => {
  it('akun kosong → index 0', () => {
    expect(rehabPosition([])).toEqual({ sessionIndex: 0, totalCompleted: 0 })
    expect(rehabSuggestKey([])).toBe('leg-iso')
  })
  it('riwayat 5/3/1 tidak majuin rehab (mulai R1-S01)', () => {
    const sessions = [
      sess({ id: 'a', planName: 'Pull Day' }),
      sess({ id: 'b', planName: 'Push Day' }),
      sess({ id: 'c', planName: 'Leg Day' }),
    ]
    expect(rehabPosition(sessions)).toEqual({ sessionIndex: 0, totalCompleted: 0 })
    expect(rehabSuggestKey(sessions)).toBe('leg-iso')
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
  it('cardio era rehab (stiker [R..]) DIHITUNG; cardio lama tidak', () => {
    expect(rehabPosition([sess({ id: 'a', planName: 'Cardio Day' })]).totalCompleted).toBe(0)
    expect(
      rehabPosition([sess({ id: 'b', planName: 'Cardio Day', cycleLabel: '[R1-S08] Cardio Day — W2' })]).totalCompleted,
    ).toBe(1)
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

describe('rehabRound / rehabCellStatus', () => {
  it('mulai R1, semua todo kecuali S1 current', () => {
    expect(rehabRound(0)).toBe(1)
    expect(rehabCellStatus(0, 0)).toBe('current')
    expect(rehabCellStatus(0, 15)).toBe('todo')
  })
  it('selesai 3 sesi → S1-S3 done, S4 current', () => {
    expect(rehabCellStatus(3, 0)).toBe('done')
    expect(rehabCellStatus(3, 2)).toBe('done')
    expect(rehabCellStatus(3, 3)).toBe('current')
    expect(rehabCellStatus(3, 4)).toBe('todo')
  })
  it('selesai 16 → R2, semua terang lagi kecuali S1 current', () => {
    expect(rehabRound(16)).toBe(2)
    expect(rehabCellStatus(16, 15)).toBe('done')
    expect(rehabCellStatus(16, 16)).toBe('current')
    expect(rehabCellStatus(16, 17)).toBe('todo')
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
