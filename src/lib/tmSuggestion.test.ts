import { describe, it, expect } from 'vitest'
import { suggestTm, roundTo2_5 } from './tmSuggestion'
import type { Exercise, Session } from '../types'

const exercises: Exercise[] = [
  { id: 'squat', name: 'Barbell Squat', muscleGroup: 'Kaki', equipment: 'Barbell' },
  { id: 'bench', name: 'Bench Press', muscleGroup: 'Dada', equipment: 'Barbell' },
  { id: 'incline', name: 'Incline DB press', muscleGroup: 'Dada', equipment: 'Dumbbell' },
  { id: 'deadlift', name: 'Deadlift', muscleGroup: 'Punggung', equipment: 'Barbell' },
]

function mkSession(id: string, date: string, sets: Session['sets'], over: Partial<Session> = {}): Session {
  return {
    id,
    date,
    planId: null,
    planName: 'Leg Day',
    note: '',
    startedAt: Date.UTC(2026, 7, 26, 5),
    endedAt: Date.UTC(2026, 7, 26, 6),
    sets,
    ...over,
  }
}

// today tetap supaya window bisa dihitung presisi
const TODAY = '2026-08-26'

describe('roundTo2_5', () => {
  it('pembulatan ke piringan 2,5 kg', () => {
    expect(roundTo2_5(105)).toBe(105)
    expect(roundTo2_5(103.4)).toBe(102.5)
    expect(roundTo2_5(106.3)).toBe(107.5)
    expect(roundTo2_5(0)).toBe(0)
  })
})

describe('suggestTm', () => {
  it('pilih e1RM terbaik dalam window; abaikan sesi berjalan & gerakan non-SBD', () => {
    const sessions = [
      mkSession('a', '2026-08-20', [
        { id: 'x1', exerciseId: 'squat', setNumber: 1, weightKg: 100, reps: 5 }, // e1RM 116,7
        { id: 'x2', exerciseId: 'incline', setNumber: 1, weightKg: 200, reps: 5 }, // incline ≠ bench
      ]),
      mkSession('b', '2026-08-24', [
        { id: 'y1', exerciseId: 'bench', setNumber: 1, weightKg: 80, reps: 3 }, // e1RM 88
      ]),
      mkSession('c', '2026-08-25', [
        { id: 'z1', exerciseId: 'squat', setNumber: 1, weightKg: 150, reps: 10 }, // berjalan → diabaikan
      ], { endedAt: null }),
    ]
    const out = suggestTm(sessions, exercises, undefined, { weeks: 8, today: TODAY })

    const squat = out.find((s) => s.key === 'squat')!
    // 116,67 × 0,9 = 105 → sudah kelipatan 2,5
    expect(squat.bestE1rm).toBeCloseTo(116.7, 1)
    expect(squat.suggestedTm).toBe(105)
    expect(squat.hasData).toBe(true)
    expect(squat.status).toBe('naik') // currentTm 0

    const bench = out.find((s) => s.key === 'bench')!
    expect(bench.bestE1rm).toBeCloseTo(88, 1) // incline tidak terhitung sebagai bench
    expect(bench.suggestedTm).toBe(80) // 79,2 → 80
  })

  it('status turun / pas terhadap TM sekarang', () => {
    const s = mkSession('a', '2026-08-20', [
      { id: 'x1', exerciseId: 'deadlift', setNumber: 1, weightKg: 100, reps: 3 }, // e1RM 110
    ])
    const out = suggestTm([s], exercises, { squat: 0, bench: 0, deadlift: 100 }, { weeks: 8, today: TODAY })
    const dl = out.find((x) => x.key === 'deadlift')!
    // 110 × 0,9 = 99 → 100 (round 99/2.5=39.6→40→100)... delta 0 → pas
    expect(dl.suggestedTm).toBe(100)
    expect(dl.status).toBe('pas')

    const out2 = suggestTm([s], exercises, { squat: 0, bench: 0, deadlift: 120 }, { weeks: 8, today: TODAY })
    expect(out2.find((x) => x.key === 'deadlift')!.status).toBe('turun')
  })

  it('window kosong → fallback semua riwayat dengan penanda', () => {
    const old = mkSession('old', '2026-03-01', [
      { id: 'o1', exerciseId: 'squat', setNumber: 1, weightKg: 90, reps: 5 },
    ])
    const out = suggestTm([old], exercises, undefined, { weeks: 8, today: TODAY })
    const squat = out.find((x) => x.key === 'squat')!
    expect(squat.hasData).toBe(true)
    expect(squat.fallbackAllTime).toBe(true)
    expect(squat.suggestedTm).toBe(95) // e1RM 105 ×0,9 = 94,5 → 95
  })

  it('tidak ada data sama sekali → hasData false, saran 0', () => {
    const out = suggestTm([], exercises, undefined, { weeks: 8, today: TODAY })
    expect(out.every((s) => !s.hasData && s.suggestedTm === 0)).toBe(true)
  })
})
describe('tmSuggestion extra: roundTo2_5 & status', () => {
  it('roundTo2_5 tepi', () => {
    expect(roundTo2_5(100)).toBe(100)
    expect(roundTo2_5(101)).toBe(100)
    expect(roundTo2_5(102.5)).toBe(102.5)
    expect(roundTo2_5(103.7)).toBe(102.5)
  })
  it('status pas saat delta <2.5', () => {
    const s = mkSession('a', '2026-08-20', [{ id: 'x1', exerciseId: 'squat', setNumber: 1, weightKg: 100, reps: 5 }])
    const out = suggestTm([s], exercises, { squat: 105, bench: 0, deadlift: 0 }, { weeks: 8, today: TODAY })
    // best e1rm 116.7 *0.9=105 → suggested 105 → delta 0 → pas
    expect(out.find(x=>x.key==='squat')!.status).toBe('pas')
  })
})
