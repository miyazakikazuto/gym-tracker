import { describe, it, expect } from 'vitest'
import { buildTrendWeeks, buildTrendMap } from './trend'
import type { Exercise, Session } from '../types'

const exercises: Exercise[] = [
  { id: 'squat', name: 'Barbell Squat', muscleGroup: 'Kaki', equipment: 'Barbell' },
  { id: 'plank', name: 'Plank', muscleGroup: 'Core', equipment: 'Bodyweight', type: 'duration' },
]

const TODAY = '2026-08-26' // Rabu → blok minggu ini 24–30 Agu
const weeks = buildTrendWeeks(TODAY)

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

function set(id: string, exerciseId: string, weightKg: number, reps: number) {
  return { id, exerciseId, setNumber: 1, weightKg, reps }
}

describe('buildTrendWeeks', () => {
  it('8 blok Senin–Minggu, terbaru di akhir', () => {
    expect(weeks).toHaveLength(8)
    expect(weeks[7]).toEqual({ start: '2026-08-24', end: '2026-08-30' })
    expect(weeks[6]).toEqual({ start: '2026-08-17', end: '2026-08-23' })
    expect(weeks[0]).toEqual({ start: '2026-07-06', end: '2026-07-12' })
  })
})

describe('buildTrendMap', () => {
  it('ambil e1RM terbaik per minggu + simpan set asalnya', () => {
    const map = buildTrendMap(
      [
        mkSession('a', '2026-08-19', [set('a1', 'squat', 100, 5)]), // e1RM 116,7
        mkSession('b', '2026-08-25', [
          set('b1', 'squat', 90, 8), // e1RM 114 — kalah dari set berikut
          set('b2', 'squat', 110, 3), // e1RM 121 — menang
        ]),
      ],
      exercises,
      weeks,
    )
    const points = map.get('squat')!
    expect(points).toHaveLength(8)
    expect(points[6]?.e1rm).toBeCloseTo(116.667, 2)
    expect(points[6]).toMatchObject({ weightKg: 100, reps: 5, date: '2026-08-19' })
    expect(points[7]?.e1rm).toBeCloseTo(121, 2)
    expect(points[7]).toMatchObject({ weightKg: 110, reps: 3, date: '2026-08-25' })
    expect(points[0]).toBeNull()
  })

  it('set reps tinggi tidak bisa mengalahkan beban berat', () => {
    const map = buildTrendMap(
      [
        // 60 kg × 30 = e1RM 120 di Epley mentah — sekarang di luar rentang valid
        mkSession('a', '2026-08-24', [set('a1', 'squat', 60, 30)]),
        mkSession('b', '2026-08-25', [set('b1', 'squat', 100, 5)]),
      ],
      exercises,
      weeks,
    )
    const p = map.get('squat')![7]
    expect(p).toMatchObject({ weightKg: 100, reps: 5 })
    expect(p!.e1rm).toBeCloseTo(116.667, 2)
  })

  it('minggu yang hanya berisi reps tinggi → gerakan tidak punya titik sama sekali', () => {
    const map = buildTrendMap(
      [mkSession('a', '2026-08-25', [set('a1', 'squat', 60, 20)])],
      exercises,
      weeks,
    )
    expect(map.get('squat')).toBeUndefined()
  })

  it('abaikan sesi berjalan, gerakan durasi, dan set tanpa beban', () => {
    const map = buildTrendMap(
      [
        mkSession('running', '2026-08-25', [set('r1', 'squat', 150, 5)], { endedAt: null }),
        mkSession('iso', '2026-08-25', [set('i1', 'plank', 20, 0)]),
        mkSession('bw', '2026-08-25', [set('w1', 'squat', 0, 10)]),
        mkSession('lama', '2026-06-01', [set('o1', 'squat', 200, 5)]),
      ],
      exercises,
      weeks,
    )
    expect(map.size).toBe(0)
  })

  it('reps 12 masih dihitung, 13 tidak', () => {
    const map = buildTrendMap(
      [
        mkSession('a', '2026-08-25', [
          set('a1', 'squat', 80, 12), // e1RM 112
          set('a2', 'squat', 90, 13), // di luar batas → 0
        ]),
      ],
      exercises,
      weeks,
    )
    expect(map.get('squat')![7]).toMatchObject({ weightKg: 80, reps: 12 })
  })
})
