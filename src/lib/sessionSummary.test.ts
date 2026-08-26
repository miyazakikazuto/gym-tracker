import { describe, it, expect } from 'vitest'
import { formatSessionForAI, findPrevSessionsByExercise, isCardioExercise } from './sessionSummary'
import type { Exercise, Session } from '../types'

const exercises: Exercise[] = [
  { id: 'bench', name: 'Bench Press', muscleGroup: 'Dada', equipment: 'Barbell' },
  { id: 'plank', name: 'Plank', muscleGroup: 'Core', equipment: 'Bodyweight', type: 'duration' },
  { id: 'tread', name: 'Treadmill', muscleGroup: 'Cardio', equipment: 'Machine' },
]

let seq = 0
function mkSession(over: Partial<Session> = {}): Session {
  seq += 1
  return {
    id: `s${seq}`,
    date: '2026-08-26',
    planId: null,
    planName: 'Push Day',
    note: '',
    startedAt: Date.UTC(2026, 7, 26, 5, 0),
    endedAt: Date.UTC(2026, 7, 26, 5, 45),
    sets: [],
    ...over,
  }
}

describe('formatSessionForAI', () => {
  it('format dasar: header + gerakan reps + total', () => {
    const s = mkSession({
      sets: [
        { id: 'a', exerciseId: 'bench', setNumber: 1, weightKg: 60, reps: 5 },
        { id: 'b', exerciseId: 'bench', setNumber: 2, weightKg: 60, reps: 4 },
      ],
      rpes: { bench: 8 },
    })
    const out = formatSessionForAI(s, exercises)
    expect(out).toContain('Latihan 26 Agu 2026 — Push Day (45 menit)')
    expect(out).toContain('1. Bench Press — 60kg×5, 60kg×4')
    expect(out).toContain('e1RM ~')
    expect(out).toMatch(/Total: 2 set · 540 kg volume · RPE rata-rata 8/)
  })

  it('gerakan durasi & cardio memakai format menit/km', () => {
    const s = mkSession({
      sets: [
        { id: 'a', exerciseId: 'plank', setNumber: 1, weightKg: 0, reps: 0, durationSec: 90 },
        { id: 'b', exerciseId: 'tread', setNumber: 1, weightKg: 0, reps: 0, durationSec: 1200, distanceKm: 3.2 },
      ],
    })
    const out = formatSessionForAI(s, exercises)
    expect(out).toContain('Plank — 1,5 mnt')
    expect(out).toContain('Treadmill — 20 mnt · 3,2 km')
  })

  it('beban 0 pada gerakan reps → BW', () => {
    const s = mkSession({
      sets: [{ id: 'a', exerciseId: 'bench', setNumber: 1, weightKg: 0, reps: 12 }],
    })
    expect(formatSessionForAI(s, exercises)).toContain('Bench Press — BW×12')
  })

  it('catatan kosong tidak memunculkan baris Catatan', () => {
    const out = formatSessionForAI(mkSession(), exercises)
    expect(out).not.toContain('Catatan:')
  })

  it('marker naik / turun / sama vs sesi pembanding', () => {
    const prev = mkSession({
      id: 'prev',
      date: '2026-08-20',
      sets: [{ id: 'p1', exerciseId: 'bench', setNumber: 1, weightKg: 57.5, reps: 5 }],
    })
    const cur = (w: number) =>
      mkSession({ sets: [{ id: 'c1', exerciseId: 'bench', setNumber: 1, weightKg: w, reps: 5 }] })

    const up = formatSessionForAI(cur(60), exercises, new Map([['bench', prev]]))
    expect(up).toContain('↑2,5kg vs sebelumnya')

    const down = formatSessionForAI(cur(55), exercises, new Map([['bench', prev]]))
    expect(down).toContain('↓2,5kg vs sebelumnya')

    const same = formatSessionForAI(cur(57.5), exercises, new Map([['bench', prev]]))
    expect(same).toContain('→ sama dengan sebelumnya')

    // tanpa pembanding → tanpa marker
    expect(formatSessionForAI(cur(60), exercises)).not.toContain('vs sebelumnya')
  })
})

describe('findPrevSessionsByExercise', () => {
  it('pilih sesi selesai TERBARU yang memuat gerakan; abaikan berjalan & current', () => {
    const older = mkSession({
      id: 'old',
      date: '2026-08-10',
      sets: [{ id: 'o1', exerciseId: 'bench', setNumber: 1, weightKg: 50, reps: 5 }],
    })
    const newer = mkSession({
      id: 'new',
      date: '2026-08-20',
      sets: [{ id: 'n1', exerciseId: 'bench', setNumber: 1, weightKg: 57.5, reps: 5 }],
    })
    const running = mkSession({
      id: 'run',
      date: '2026-08-25',
      endedAt: null,
      sets: [{ id: 'r1', exerciseId: 'bench', setNumber: 1, weightKg: 70, reps: 5 }],
    })
    const cur = mkSession({
      id: 'cur',
      sets: [{ id: 'c1', exerciseId: 'bench', setNumber: 1, weightKg: 60, reps: 5 }],
    })
    const map = findPrevSessionsByExercise([older, newer, running], cur)
    expect(map.get('bench')?.id).toBe('new')
  })

  it('gerakan tanpa riwayat tidak masuk map', () => {
    const cur = mkSession({
      sets: [{ id: 'c1', exerciseId: 'tread', setNumber: 1, weightKg: 0, reps: 0, durationSec: 600 }],
    })
    expect(findPrevSessionsByExercise([], cur).size).toBe(0)
  })
})

describe('isCardioExercise', () => {
  it('deteksi via muscleGroup atau category', () => {
    expect(isCardioExercise(exercises, 'tread')).toBe(true)
    expect(isCardioExercise(exercises, 'bench')).toBe(false)
    expect(isCardioExercise([{ id: 'x', name: 'X', muscleGroup: 'Kaki', equipment: '', category: 'cardio' }], 'x')).toBe(true)
  })
})
