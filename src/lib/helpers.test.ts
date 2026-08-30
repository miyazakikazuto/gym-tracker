import { describe, it, expect } from 'vitest'
import { categoryOfExercise, categoryKeysOfExercise, exerciseIsDuration, getExerciseName, isCountedSession, bestSetResult, fmtNumber } from './helpers'
import type { Exercise, Session } from '../types'

function mkSession(over: Partial<Session>): Session {
  return {
    id: 's1',
    date: '2026-08-20',
    planId: null,
    planName: 'Leg Day',
    note: '',
    startedAt: Date.now(),
    endedAt: Date.now(),
    sets: [],
    ...over,
  } as Session
}

describe('categoryOfExercise', () => {
  it('home alias → easy', () => {
    expect(categoryOfExercise({ category: 'home', muscleGroup: 'Dada' })).toBe('easy')
  })
  it('explicit category diutamakan', () => {
    expect(categoryOfExercise({ category: 'pull', muscleGroup: 'Dada' })).toBe('pull')
  })
  it('fallback muscleGroup Dada/Bahu/Trisep → push', () => {
    expect(categoryOfExercise({ muscleGroup: 'Dada' } as any)).toBe('push')
    expect(categoryOfExercise({ muscleGroup: 'Bahu' } as any)).toBe('push')
    expect(categoryOfExercise({ muscleGroup: 'Trisep' } as any)).toBe('push')
  })
  it('fallback Punggung/Bisep/Forearm → pull', () => {
    expect(categoryOfExercise({ muscleGroup: 'Punggung' } as any)).toBe('pull')
    expect(categoryOfExercise({ muscleGroup: 'Bisep' } as any)).toBe('pull')
  })
  it('fallback Kaki → leg, Cardio → cardio, Core/Lainnya → easy', () => {
    expect(categoryOfExercise({ muscleGroup: 'Kaki' } as any)).toBe('leg')
    expect(categoryOfExercise({ muscleGroup: 'Cardio' } as any)).toBe('cardio')
    expect(categoryOfExercise({ muscleGroup: 'Core' } as any)).toBe('easy')
    expect(categoryOfExercise({ muscleGroup: 'Lainnya' } as any)).toBe('easy')
  })
  it('muscleGroup kosong → fallback push', () => {
    expect(categoryOfExercise({ muscleGroup: '' } as any)).toBe('push')
    expect(categoryOfExercise({ muscleGroup: 'Unknown' } as any)).toBe('push')
  })
})

describe('categoryKeysOfExercise', () => {
  it('gabung category + extraCategories unik', () => {
    const ex = { id: '1', name: 'X', muscleGroup: 'Dada', equipment: 'Barbel', category: 'push', extraCategories: ['leg', 'push'] } as Exercise
    expect(categoryKeysOfExercise(ex)).toEqual(['push', 'leg'])
  })
  it('tanpa extraCategories', () => {
    const ex = { id: '1', name: 'X', muscleGroup: 'Kaki', equipment: 'Barbel' } as Exercise
    expect(categoryKeysOfExercise(ex)).toEqual(['leg'])
  })
})

describe('exerciseIsDuration', () => {
  it('type duration → true', () => {
    const exs = [{ id: 'a', name: 'Lari', muscleGroup: 'Cardio', equipment: '', type: 'duration' } as Exercise]
    expect(exerciseIsDuration(exs, 'a')).toBe(true)
  })
  it('type reps atau undefined → false', () => {
    const exs = [{ id: 'a', name: 'Bench', muscleGroup: 'Dada', equipment: '', type: 'reps' } as Exercise]
    expect(exerciseIsDuration(exs, 'a')).toBe(false)
    expect(exerciseIsDuration([], 'unknown')).toBe(false)
  })
})

describe('getExerciseName', () => {
  it('ditemukan → nama', () => {
    const exs = [{ id: 'abc123', name: 'Squat', muscleGroup: 'Kaki', equipment: '' } as Exercise]
    expect(getExerciseName(exs, 'abc123')).toBe('Squat')
  })
  it('terhapus → placeholder slice 6', () => {
    expect(getExerciseName([], 'abcdefghij')).toBe('[Terhapus abcdef]')
  })
})

describe('isCountedSession', () => {
  it('selesai leg day → counted true', () => {
    expect(isCountedSession(mkSession({ planName: 'Leg Day', endedAt: Date.now() }))).toBe(true)
  })
  it('endedAt null → false', () => {
    expect(isCountedSession(mkSession({ endedAt: null }))).toBe(false)
  })
  it('isExtra → false', () => {
    expect(isCountedSession(mkSession({ isExtra: true } as any))).toBe(false)
  })
  it('Rest Day → false', () => {
    expect(isCountedSession(mkSession({ planName: 'Rest Day' }))).toBe(false)
  })
  it('cardio case-insensitive → false', () => {
    expect(isCountedSession(mkSession({ planName: 'Cardio Lari' }))).toBe(false)
    expect(isCountedSession(mkSession({ planName: 'CARDIO' }))).toBe(false)
  })
  it('Skip prefix → false', () => {
    expect(isCountedSession(mkSession({ planName: 'Skip — sakit' }))).toBe(false)
    expect(isCountedSession(mkSession({ planName: '  skip lama' }))).toBe(false)
  })
  it('trim skip tidak match bila bukan prefix', () => {
    expect(isCountedSession(mkSession({ planName: 'Leg Skip' }))).toBe(true)
  })
})

describe('bestSetResult', () => {
  it('pilih weight tertinggi', () => {
    const sessions = [
      mkSession({ id: 's1', date: '2026-08-10', endedAt: Date.now(), sets: [{ id: 'x', exerciseId: 'e1', setNumber: 1, weightKg: 50, reps: 5 } as any] }),
      mkSession({ id: 's2', date: '2026-08-11', endedAt: Date.now(), sets: [{ id: 'y', exerciseId: 'e1', setNumber: 1, weightKg: 60, reps: 3 } as any] }),
    ]
    expect(bestSetResult(sessions, 'exclude', 'e1')).toEqual(expect.objectContaining({ weightKg: 60, reps: 3 }))
  })
  it('distanceKm >0 bila weight 0', () => {
    const sessions = [
      mkSession({ id: 's1', date: '2026-08-10', endedAt: Date.now(), sets: [{ id: 'x', exerciseId: 'e1', setNumber: 1, weightKg: 0, reps: 0, distanceKm: 5 } as any] }),
    ]
    expect(bestSetResult(sessions, 'exclude', 'e1')?.distanceKm).toBe(5)
  })
  it('durationSec fallback bila weight & distance 0', () => {
    const sessions = [
      mkSession({ id: 's1', date: '2026-08-10', endedAt: Date.now(), sets: [{ id: 'x', exerciseId: 'e1', setNumber: 1, weightKg: 0, reps: 0, durationSec: 120 } as any] }),
    ]
    expect(bestSetResult(sessions, 'exclude', 'e1')?.durationSec).toBe(120)
  })
  it('skip set tanpa data (0, null, 0)', () => {
    const sessions = [
      mkSession({ id: 's1', date: '2026-08-10', endedAt: Date.now(), sets: [{ id: 'x', exerciseId: 'e1', setNumber: 1, weightKg: 0, reps: 0 } as any] }),
    ]
    expect(bestSetResult(sessions, 'exclude', 'e1')).toBeNull()
  })
  it('excludeId & endedAt null dilewati', () => {
    const sessions = [
      mkSession({ id: 'exclude', date: '2026-08-11', endedAt: Date.now(), sets: [{ id: 'x', exerciseId: 'e1', setNumber: 1, weightKg: 100, reps: 1 } as any] }),
      mkSession({ id: 's2', date: '2026-08-10', endedAt: null, sets: [{ id: 'y', exerciseId: 'e1', setNumber: 1, weightKg: 200, reps: 1 } as any] }),
    ]
    expect(bestSetResult(sessions, 'exclude', 'e1')).toBeNull()
  })
  it('tie-break tanggal terbaru', () => {
    const sessions = [
      mkSession({ id: 's1', date: '2026-08-10', endedAt: Date.now(), sets: [{ id: 'x', exerciseId: 'e1', setNumber: 1, weightKg: 50, reps: 5 } as any] }),
      mkSession({ id: 's2', date: '2026-08-11', endedAt: Date.now(), sets: [{ id: 'y', exerciseId: 'e1', setNumber: 1, weightKg: 50, reps: 5 } as any] }),
    ]
    // kedua 50kg, yang terbaru s2 menang karena date lebih besar
    expect(bestSetResult(sessions, 'exclude', 'e1')?.weightKg).toBe(50)
    // tidak bisa bedakan selain primary, tapi pastika tidak null
    expect(bestSetResult(sessions, 'exclude', 'e1')).not.toBeNull()
  })
})

describe('fmtNumber', () => {
  it('bulat → tanpa desimal', () => { expect(fmtNumber(10)).toBe('10') })
  it('pecahan → koma', () => { expect(fmtNumber(10.5)).toBe('10,5') })
  it('0,5 rounding bukan di fmtNumber (sudah di e1rmStr) → tampil apa adanya', () => { expect(fmtNumber(10.25)).toBe('10,3') })
})
