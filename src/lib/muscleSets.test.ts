import { describe, it, expect } from 'vitest'
import type { Exercise, Session, SessionSet } from '../types'
import {
  avgWeeklySetsPerMuscle,
  setTargetStatus,
  SET_TARGET_MIN,
  SET_TARGET_MAX,
} from './muscleSets'

const TODAY = '2026-11-25' // Rabu; Senin minggu ini = 2026-11-23

function ex(id: string, name: string, muscleGroup: string): Exercise {
  return { id, name, muscleGroup, equipment: 'Barbell' }
}

function set(id: string, exerciseId: string): SessionSet {
  return { id, exerciseId, setNumber: 1, weightKg: 50, reps: 8 }
}

function sess(id: string, date: string, endedAt: number | null, sets: SessionSet[]): Session {
  return { id, date, planId: null, planName: '', note: '', startedAt: 0, endedAt, sets }
}

const EXERCISES = [
  ex('bench', 'Bench Press', 'Dada'),
  ex('squat', 'Squat', 'Kaki'),
  ex('row', 'Seated Row', 'Punggung'),
  ex('curl', 'Bicep Curl', 'Bisep'),
]

describe('setTargetStatus', () => {
  it('di bawah min = kurang', () => {
    expect(setTargetStatus(0)).toBe('kurang')
    expect(setTargetStatus(SET_TARGET_MIN - 0.1)).toBe('kurang')
  })
  it('tepat di batas min dan maks = pas', () => {
    expect(setTargetStatus(SET_TARGET_MIN)).toBe('pas')
    expect(setTargetStatus(SET_TARGET_MAX)).toBe('pas')
  })
  it('di atas maks = lebih', () => {
    expect(setTargetStatus(SET_TARGET_MAX + 0.1)).toBe('lebih')
  })
})

describe('avgWeeklySetsPerMuscle', () => {
  it('rata-rata 4 minggu dari set primer saja', () => {
    // Jendela 4 minggu dari 25 Nov 2026: 2, 9, 16, 23 Nov.
    // Bench 8 set di minggu 2 Nov + 4 set di minggu 9 Nov = 12 set / 4 minggu = 3
    const sessions = [
      sess('s1', '2026-11-03', 1, [1, 2, 3, 4, 5, 6, 7, 8].map((n) => set('b' + n, 'bench'))),
      sess('s2', '2026-11-10', 1, [1, 2, 3, 4].map((n) => set('c' + n, 'bench'))),
    ]
    const { rows } = avgWeeklySetsPerMuscle(sessions, EXERCISES, TODAY, 4, false)
    const dada = rows.find((r) => r.muscle === 'Dada')!
    expect(dada.avgPerWeek).toBeCloseTo(3, 5)
    expect(dada.thisWeek).toBe(0)
  })

  it('sesi belum selesai dan di luar jendela tidak dihitung', () => {
    const sessions = [
      sess('s1', '2026-11-24', null, [set('a', 'bench')]), // belum selesai
      sess('s2', '2026-10-01', 1, [set('b', 'bench')]), // di luar 4 minggu
      sess('s3', '2026-11-24', 1, [set('c', 'bench')]), // minggu ini, selesai
    ]
    const { rows } = avgWeeklySetsPerMuscle(sessions, EXERCISES, TODAY, 4, false)
    const dada = rows.find((r) => r.muscle === 'Dada')!
    expect(dada.avgPerWeek).toBeCloseTo(0.25, 5)
    expect(dada.thisWeek).toBe(1)
  })

  it('set sekunder dihitung pecahan bila inclSecondary', () => {
    // Bench Press → Trisep 0,5 + Bahu 0,3. 4 set bench dalam 1 minggu.
    const sessions = [sess('s1', '2026-11-24', 1, [1, 2, 3, 4].map((n) => set('b' + n, 'bench')))]
    const withSec = avgWeeklySetsPerMuscle(sessions, EXERCISES, TODAY, 4, true)
    const trisep = withSec.rows.find((r) => r.muscle === 'Trisep')!
    const bahu = withSec.rows.find((r) => r.muscle === 'Bahu')!
    expect(trisep.avgPerWeek).toBeCloseTo(0.5, 5)
    expect(bahu.avgPerWeek).toBeCloseTo(0.3, 5)
    const noSec = avgWeeklySetsPerMuscle(sessions, EXERCISES, TODAY, 4, false)
    expect(noSec.rows.find((r) => r.muscle === 'Trisep')!.avgPerWeek).toBe(0)
  })

  it('gerakan tak dikenal dan grup Cardio diabaikan', () => {
    const sessions = [
      sess('s1', '2026-11-24', 1, [
        set('a', 'tidak-ada'),
        set('b', 'run'),
      ]),
    ]
    const exs = [...EXERCISES, ex('run', 'Lari', 'Cardio')]
    const { rows } = avgWeeklySetsPerMuscle(sessions, exs, TODAY, 4, true)
    expect(rows.every((r) => r.avgPerWeek === 0)).toBe(true)
  })

  it('thisWeek: hanya sesi minggu berjalan, sekunder ikut pecahan', () => {
    // Squat 2 set minggu ini (24 Nov) + 2 set minggu lalu (18 Nov).
    // Squat → Punggung 0,3 + Core 0,4 per set.
    const sessions = [
      sess('s1', '2026-11-24', 1, [set('a', 'squat'), set('b', 'squat')]),
      sess('s2', '2026-11-18', 1, [set('c', 'squat'), set('d', 'squat')]),
    ]
    const { rows, thisWeekLabel } = avgWeeklySetsPerMuscle(sessions, EXERCISES, TODAY, 4, true)
    const kaki = rows.find((r) => r.muscle === 'Kaki')!
    const punggung = rows.find((r) => r.muscle === 'Punggung')!
    const core = rows.find((r) => r.muscle === 'Core')!
    expect(kaki.thisWeek).toBe(2)
    expect(kaki.avgPerWeek).toBeCloseTo(1, 5)
    expect(punggung.thisWeek).toBeCloseTo(0.6, 5)
    expect(core.thisWeek).toBeCloseTo(0.8, 5)
    expect(thisWeekLabel).toBe('23 Nov–29 Nov 2026')
  })

  it('semua 8 otot selalu ada dan terurut menurun', () => {
    const sessions = [sess('s1', '2026-11-24', 1, [set('a', 'squat'), set('b', 'squat')])]
    const { rows, windowLabel } = avgWeeklySetsPerMuscle(sessions, EXERCISES, TODAY, 4, true)
    expect(rows).toHaveLength(8)
    expect(rows[0].muscle).toBe('Kaki')
    expect(windowLabel).toContain('2026')
  })
})
