import { describe, it, expect } from 'vitest'
import { buildQuickWalkSet, findTodayCardioSession, findWalkExercise } from './gymstore'
import type { Exercise, Session } from '../types'

const exs: Exercise[] = [
  { id: 'jk', name: 'Jalan Kaki', muscleGroup: 'Cardio', equipment: 'Bodyweight' },
  { id: 'sq', name: 'Squat', muscleGroup: 'Kaki', equipment: 'Barbell' },
]

function sess(id: string, over: Partial<Session> = {}): Session {
  return {
    id,
    date: '2026-09-12',
    planId: null,
    planName: 'Cardio Day',
    note: '',
    startedAt: 1,
    endedAt: 2,
    sets: [],
    ...over,
  }
}

const runSet = (exerciseId: string, setNumber = 1) => ({
  id: `s${exerciseId}${setNumber}`, exerciseId, setNumber, weightKg: 0, reps: 0, durationSec: 600, distanceKm: 1,
})

describe('buildQuickWalkSet', () => {
  it('set valid: jarak 2 digit, durasi dibulatkan, elevasi opsional', () => {
    const s = buildQuickWalkSet('jk', 2, 3.256, 125.6, 24)
    expect(s).toMatchObject({ exerciseId: 'jk', setNumber: 2, weightKg: 0, reps: 0, durationSec: 126, distanceKm: 3.26, elevationM: 24 })
    expect(s?.id).toBeTruthy()
  })
  it('tanpa elevasi → field absen', () => {
    expect(buildQuickWalkSet('jk', 1, 1, 60)?.elevationM).toBeUndefined()
  })
  it('nolak jarak 0/negatif, id kosong, durasi negatif', () => {
    expect(buildQuickWalkSet('jk', 1, 0, 60)).toBeNull()
    expect(buildQuickWalkSet('jk', 1, -1, 60)).toBeNull()
    expect(buildQuickWalkSet('', 1, 1, 60)).toBeNull()
    expect(buildQuickWalkSet('jk', 1, 1, -5)).toBeNull()
  })
})

describe('findTodayCardioSession', () => {
  it('sesi berjalan didahulukan dari yang selesai', () => {
    const done = sess('done', { sets: [runSet('jk')], startedAt: 1 })
    const run = sess('run', { endedAt: null, planName: 'Leg Day', sets: [runSet('jk')], startedAt: 5 })
    expect(findTodayCardioSession([done, run], exs, '2026-09-12')?.id).toBe('run')
  })
  it('tanpa yang berjalan → yang selesai terbaru', () => {
    const a = sess('a', { sets: [runSet('jk')], startedAt: 1 })
    const b = sess('b', { sets: [runSet('jk')], startedAt: 9 })
    expect(findTodayCardioSession([a, b], exs, '2026-09-12')?.id).toBe('b')
  })
  it('sesi tanpa set cardio / beda tanggal → undefined', () => {
    const leg = sess('leg', { planName: 'Leg Day', sets: [{ id: 'x', exerciseId: 'sq', setNumber: 1, weightKg: 10, reps: 10 }] })
    const other = sess('other', { date: '2026-09-11', sets: [runSet('jk')] })
    expect(findTodayCardioSession([leg, other], exs, '2026-09-12')).toBeUndefined()
  })
})

describe('findWalkExercise', () => {
  it('Jalan Kaki diutamakan (case-insensitive)', () => {
    const list: Exercise[] = [
      { id: 't', name: 'Treadmill', muscleGroup: 'Cardio', equipment: 'Bodyweight' },
      { id: 'j', name: 'JALAN KAKI', muscleGroup: 'Cardio', equipment: 'Bodyweight' },
    ]
    expect(findWalkExercise(list)?.id).toBe('j')
  })
  it('fallback cardio pertama; undefined bila tidak ada', () => {
    expect(findWalkExercise([exs[1], exs[0]])?.id).toBe('jk')
    expect(findWalkExercise([exs[1]])).toBeUndefined()
  })
})
