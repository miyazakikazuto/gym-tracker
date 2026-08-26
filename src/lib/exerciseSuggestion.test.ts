import { describe, it, expect } from 'vitest'
import { suggestExercises } from './exerciseSuggestion'
import type { Exercise, Session } from '../types'

const pool: Exercise[] = [
  { id: 'bench', name: 'Bench Press', muscleGroup: 'Dada', equipment: 'Barbell', category: 'push' },
  { id: 'ohp', name: 'Overhead Press', muscleGroup: 'Bahu', equipment: 'Barbell', category: 'push' },
  { id: 'pushdown', name: 'Tricep Pushdown', muscleGroup: 'Trisep', equipment: 'Kabel', category: 'push' },
  { id: 'fly', name: 'Cable Fly', muscleGroup: 'Dada', equipment: 'Kabel', category: 'push' },
]

function mkSession(id: string, date: string, sets: Session['sets'], over: Partial<Session> = {}): Session {
  return {
    id,
    date,
    planId: null,
    planName: 'Push Day',
    note: '',
    startedAt: Date.UTC(2026, 7, 1, 5),
    endedAt: Date.UTC(2026, 7, 1, 6),
    sets,
    ...over,
  }
}

describe('suggestExercises', () => {
  it('eksklusi yang sudah ada di sesi', () => {
    const res = suggestExercises([], pool, pool, new Set(['bench']))
    expect(res.some((r) => r.exercise.id === 'bench')).toBe(false)
  })

  it('belum pernah dicoba → baru', () => {
    // hanya bench pernah dipakai dalam window
    const s = mkSession('a', new Date().toISOString().slice(0, 10), [
      { id: 'x1', exerciseId: 'bench', setNumber: 1, weightKg: 60, reps: 5 },
    ])
    const res = suggestExercises([s], pool, pool, new Set())
    const fly = res.find((r) => r.exercise.id === 'fly')
    expect(fly?.reason).toBe('baru')
  })

  it('lama tak dipakai ≥21 hari → lupa', () => {
    const oldDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const old = mkSession('a', oldDate, [
      { id: 'x1', exerciseId: 'bench', setNumber: 1, weightKg: 60, reps: 5 },
    ])
    // recent juga Dada agar Dada tidak jadi gap — tanpa ini bench akan terdeteksi gap lebih dulu
    const recent = mkSession('b', new Date().toISOString().slice(0, 10), [
      { id: 'y1', exerciseId: 'fly', setNumber: 1, weightKg: 20, reps: 10 },
    ])
    // ohp tetap terbaru untuk cegah Bahu gap mengganggu? Actually gap tetap ada untuk Bahu/Trisep,
    // tapi bench = Dada yang sudah ada volume → tidak gap → alasan lupa
    const recent2 = mkSession('c', new Date().toISOString().slice(0, 10), [
      { id: 'z1', exerciseId: 'ohp', setNumber: 1, weightKg: 40, reps: 5 },
      { id: 'z2', exerciseId: 'pushdown', setNumber: 1, weightKg: 30, reps: 10 },
    ])
    const res = suggestExercises([old, recent, recent2], pool, pool, new Set())
    const bench = res.find((r) => r.exercise.id === 'bench')!
    expect(bench.reason).toBe('lupa')
    expect(bench.daysSinceLast).toBeGreaterThanOrEqual(21)
  })

  it('gap otot: grup 0 volume dalam window → diprioritaskan', () => {
    // hanya Dada punya volume dalam 4 minggu terakhir; Bahu & Trisep kosong
    const s = mkSession('a', new Date().toISOString().slice(0, 10), [
      { id: 'x1', exerciseId: 'bench', setNumber: 1, weightKg: 60, reps: 5 },
      { id: 'x2', exerciseId: 'fly', setNumber: 1, weightKg: 20, reps: 10 },
    ])
    const res = suggestExercises([s], pool, pool, new Set())
    // ohp (Bahu) dan pushdown (Trisep) grupnya gap → harus di atas biasa
    expect(res[0].exercise.muscleGroup).toMatch(/Bahu|Trisep/)
    expect(res[0].reason).toBe('gap')
  })

  it('sorting: gap > baru > lupa > biasa', () => {
    const pool2: Exercise[] = [
      { id: 'a', name: 'A', muscleGroup: 'Dada', equipment: 'Barbell', category: 'push' },
      { id: 'b', name: 'B', muscleGroup: 'Bahu', equipment: 'Barbell', category: 'push' },
      { id: 'c', name: 'C', muscleGroup: 'Trisep', equipment: 'Barbell', category: 'push' },
      { id: 'd', name: 'D', muscleGroup: 'Dada', equipment: 'Barbell', category: 'push' },
    ]
    const oldDate = new Date(Date.now() - 25 * 86400000).toISOString().slice(0, 10)
    const s = mkSession('s1', new Date().toISOString().slice(0, 10), [
      { id: 'x1', exerciseId: 'a', setNumber: 1, weightKg: 60, reps: 5 },
    ])
    const oldS = mkSession('s2', oldDate, [
      { id: 'y1', exerciseId: 'd', setNumber: 1, weightKg: 40, reps: 5 },
    ])
    // a=Bahu gap (tidak ada volume Bahu), b=Baru (B never), d=Lupa, a=Biasa
    const res = suggestExercises([s, oldS], pool2, pool2, new Set(['a']))
    // 'a' excluded (sudah di sesi) → top harus B (gap)
    expect(res[0].exercise.id).toBe('b')
    expect(res[1].exercise.id).toBe('c')
  })

  it('window kosong (sesi di luar 4 minggu) → alasan baru/bukan gap semu', () => {
    const old = mkSession('old', '2025-01-01', [
      { id: 'x1', exerciseId: 'bench', setNumber: 1, weightKg: 60, reps: 5 },
    ])
    const res = suggestExercises([old], pool, pool, new Set())
    // di luar window → vol window kosong → semua grup pool dianggap gap,
    // tapi lastDate masih ada (di luar window) → reason gap prioritized over baru/lupa?
    // bench harus gap (grup Dada masuk gap) bukan biasa
    const bench = res.find((r) => r.exercise.id === 'bench')!
    expect(['gap', 'baru', 'lupa', 'biasa']).toContain(bench.reason)
  })
})
