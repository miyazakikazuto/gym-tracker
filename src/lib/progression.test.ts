import { describe, it, expect } from 'vitest'
import {
  computePosition,
  computeExcludedTypes,
  dynamicCycleLength,
  getSessionLabel,
  getFullLabel,
  getScheme,
  getPrescribedWeights,
  getSbdLiftForSession,
  suggestKey531,
  get531Sequence,
} from './progression'
import { isCountedSession } from './helpers'
import type { Session, UserSettings } from '../types'

const NO_EXCLUDED = new Set<string>()

function mkSession(over: Partial<Session> = {}): Session {
  return {
    id: 's1',
    date: '2026-08-20',
    planId: null,
    planName: 'Leg Day — 3×5',
    note: '',
    startedAt: 0,
    endedAt: 1000, // selesai
    sets: [],
    ...over,
  }
}

describe('exclusion', () => {
  it('default tanpa exclusion → cycle 16', () => {
    expect(computeExcludedTypes({}).size).toBe(0)
    expect(dynamicCycleLength(NO_EXCLUDED)).toBe(16)
  })

  it('excludeEasyDay → cycle 12', () => {
    const ex = computeExcludedTypes({ excludeEasyDay: true })
    expect(ex.has('easy')).toBe(true)
    expect(dynamicCycleLength(ex)).toBe(12)
  })
})

describe('computePosition', () => {
  it('kosong → cycle 1 index 0', () => {
    const pos = computePosition([])
    expect(pos).toEqual({ cycle: 1, sessionIndex: 0, totalCompleted: 0, cycleLength: 16 })
  })

  it('16 sesi selesai → cycle 2 index 0', () => {
    const sessions = Array.from({ length: 16 }, (_, i) =>
      mkSession({ id: String(i), planName: 'Leg Day', startedAt: i, date: '2026-08-20' }),
    )
    const pos = computePosition(sessions)
    expect(pos.cycle).toBe(2)
    expect(pos.sessionIndex).toBe(0)
    expect(pos.totalCompleted).toBe(16)
  })

  it('abaikan sesi belum selesai (endedAt null)', () => {
    const pos = computePosition([mkSession({ endedAt: null })])
    expect(pos.totalCompleted).toBe(0)
  })

  it('abaikan Rest Day', () => {
    const pos = computePosition([mkSession({ planName: 'Rest Day' })])
    expect(pos.totalCompleted).toBe(0)
  })

  it('abaikan sesi cardio (case-insensitive)', () => {
    const pos = computePosition([mkSession({ planName: 'Cardio Day' }), mkSession({ planName: 'CARDIO' })])
    expect(pos.totalCompleted).toBe(0)
  })

  it('abaikan sesi Skip lama ("Skip — …")', () => {
    const pos = computePosition([
      mkSession({ planName: 'Skip — libur kerja' }),
      mkSession({ planName: 'skip day' }),
    ])
    expect(pos.totalCompleted).toBe(0)
  })

  it('skippedSessions menambah total & maju posisi', () => {
    const one = [mkSession()]
    expect(computePosition(one, NO_EXCLUDED, 0).sessionIndex).toBe(1)
    expect(computePosition(one, NO_EXCLUDED, 3).sessionIndex).toBe(4)
  })

  it('cycleLength mengikuti exclusion', () => {
    const pos = computePosition([], computeExcludedTypes({ excludeEasyDay: true }))
    expect(pos.cycleLength).toBe(12)
  })
})

describe('label & scheme lookup', () => {
  it('urutan minggu penuh: 3×5 → 3×3 → 5/3/1 → Deload', () => {
    expect(getSessionLabel(0)).toContain('3×5')
    expect(getSessionLabel(4)).toContain('3×3')
    expect(getSessionLabel(8)).toContain('5/3/1')
    expect(getSessionLabel(12)).toContain('Deload')
  })

  it('getFullLabel format C/S dua digit', () => {
    expect(getFullLabel(2, 4)).toBe('[C2-S05] Leg Day — 3×3')
  })

  it('sesi Easy Day tanpa scheme → null', () => {
    expect(getScheme(3)).toBeNull()
    expect(getScheme(15)).toBeNull()
  })

  it('alignment scheme terjaga setelah Easy Day di-exclude', () => {
    const ex = computeExcludedTypes({ excludeEasyDay: true })
    // Efektif tanpa easy: [L,Pu,Pl] ×4 — full idx 4 (Leg 3×3) turun ke eff idx 3,
    // full idx 8 (Leg 5/3/1) ke eff 6, full idx 12 (Deload) ke eff 9.
    expect(getSessionLabel(3, ex)).toContain('3×3')
    expect(getSessionLabel(6, ex)).toContain('5/3/1')
    expect(getSessionLabel(9, ex)).toContain('Deload')
    expect(getScheme(3, ex)?.type).toBe('3x3')
  })

  it('wrap modulo antar cycle', () => {
    expect(suggestKey531(0)).toBe('leg')
    expect(suggestKey531(15)).toBe('easy')
    expect(suggestKey531(16)).toBe('leg')
  })

  it('get531Sequence panjang mengikuti exclusion', () => {
    expect(get531Sequence()).toHaveLength(16)
    expect(get531Sequence(computeExcludedTypes({ excludeEasyDay: true }))).toHaveLength(12)
  })
})

describe('getPrescribedWeights', () => {
  it('TM ≤ 0 atau scheme null-type → kosong', () => {
    const deload = getScheme(12)!
    expect(getPrescribedWeights(deload, 0)).toEqual([])
  })

  it('rounding ke 0,5 kg terdekat', () => {
    const w5 = getPrescribedWeights(getScheme(0)!, 100)
    expect(w5).toEqual([{ percentage: 65, weight: 65, reps: 5 }])
  })

  it('scheme 5/3/1: persen berbeda per set + reps array + TM ganjil dibulatkan 0,5', () => {
    const w = getPrescribedWeights(getScheme(8)!, 101)
    expect(w.map((x) => x.percentage)).toEqual([70, 80, 90])
    expect(w.map((x) => x.weight)).toEqual([70.5, 81, 91])
    expect(w.map((x) => x.reps)).toEqual([5, 3, 1])
  })
})

describe('SBD lift mapping per tipe sesi', () => {
  it('leg→squat, push→bench, pull→deadlift, easy→undefined', () => {
    expect(getSbdLiftForSession(0)).toBe('squat')
    expect(getSbdLiftForSession(1)).toBe('bench')
    expect(getSbdLiftForSession(2)).toBe('deadlift')
    expect(getSbdLiftForSession(3)).toBeUndefined()
  })

  it('tetap benar setelah exclusion (tipe, bukan index)', () => {
    const ex = computeExcludedTypes({ excludeEasyDay: true })
    // eff idx 3 = full idx 4 = Leg Day (W2) → tetap squat
    expect(getSbdLiftForSession(3, ex)).toBe('squat')
    expect(getSbdLiftForSession(4, ex)).toBe('bench')
    expect(getSbdLiftForSession(5, ex)).toBe('deadlift')
  })
})

describe('UserSettings default guard', () => {
  it('excludeEasyDay undefined → tidak exclude', () => {
    const s: Partial<UserSettings> = {}
    expect(computeExcludedTypes(s).has('easy')).toBe(false)
  })
})
describe('isCountedSession parity (harus sinkron dengan rotation)', () => {
  it('5 predikat identik: endedAt null, extra, rest, cardio, skip', () => {
    function mk(over: Partial<Session>): Session {
      return { id: 'x', date: '2026-08-20', planId: null, planName: 'Leg Day', note: '', startedAt: 1, endedAt: 2, sets: [], ...over } as Session
    }
    expect(isCountedSession(mk({ endedAt: null }))).toBe(false)
    expect(isCountedSession(mk({ isExtra: true }))).toBe(false)
    expect(isCountedSession(mk({ planName: 'Rest Day' }))).toBe(false)
    expect(isCountedSession(mk({ planName: 'Cardio Run' }))).toBe(false)
    expect(isCountedSession(mk({ planName: 'Skip — sakit' }))).toBe(false)
    expect(isCountedSession(mk({ planName: 'Leg Day' }))).toBe(true)
  })
  it('dynamicCycleLength 16 vs 12 konsisten dengan computeExcludedTypes', () => {
    expect(dynamicCycleLength(computeExcludedTypes({}))).toBe(16)
    expect(dynamicCycleLength(computeExcludedTypes({ excludeEasyDay: true }))).toBe(12)
  })
  it('alignment scheme: week1 3x5 → week2 3x3 terjaga walau Easy Day diexclude', () => {
    const exOff = computeExcludedTypes({ excludeEasyDay: true })
    // tanpa exclude, index 0=3x5, index 4=3x3
    expect(getScheme(0, NO_EXCLUDED)?.label).toBe('3×5')
    expect(getScheme(4, NO_EXCLUDED)?.label).toBe('3×3')
    // dengan exclude, index tetap map ke minggu yang benar via buildEffective
    expect(getScheme(0, exOff)?.label).toBe('3×5')
    expect(getScheme(3, exOff)?.label).toBe('3×3')
  })
})
