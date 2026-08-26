import { describe, it, expect } from 'vitest'
import {
  formatPeriodForAI,
  weekWindow,
  monthWindow,
  prevWeekWindow,
  prevMonthWindow,
  listWeekOptions,
  listMonthOptions,
} from './periodSummary'
import type { Bodyweight, Exercise, Session } from '../types'

const exercises: Exercise[] = [
  { id: 'squat', name: 'Squat', muscleGroup: 'Kaki', equipment: 'Barbell' },
  { id: 'bench', name: 'Bench Press', muscleGroup: 'Dada', equipment: 'Barbell' },
  { id: 'tread', name: 'Treadmill', muscleGroup: 'Cardio', equipment: 'Machine' },
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

const WIN = { start: '2026-08-24', end: '2026-08-30' }
const PREV = { start: '2026-08-17', end: '2026-08-23' }

describe('listWeekOptions / listMonthOptions', () => {
  it('tanpa data → hanya periode berjalan', () => {
    const w = listWeekOptions([], '2026-08-26')
    expect(w).toHaveLength(1)
    expect(w[0].start).toBe('2026-08-23')
    expect(w[0].label).toBe('23–29 Agu 2026')

    const m = listMonthOptions([], '2026-08-26')
    expect(m).toHaveLength(1)
    expect(m[0].label).toBe('Agu 2026')
  })

  it('span data Juni→Agustus: bulan terurut terbaru dulu, termasuk bulan berjalan', () => {
    const sessions = [
      mkSession('a', '2026-06-15', []),
      mkSession('b', '2026-07-02', []),
      mkSession('c', '2026-08-10', []),
    ]
    const m = listMonthOptions(sessions, '2026-08-26')
    expect(m.map((o) => o.label)).toEqual(['Agu 2026', 'Jul 2026', 'Jun 2026'])
    expect(m[2]).toMatchObject({ start: '2026-06-01', end: '2026-06-30' })
  })

  it('minggu lintas bulan memakai label rentang dua bulan; cap 52', () => {
    const cross = listWeekOptions([mkSession('a', '2026-08-30', [])], '2026-09-01')
    const newest = cross[0]
    expect(newest.label).toContain('Agu')
    expect(newest.label).toContain('Sep')

    // cap: sesi pertama >1 tahun lalu → maksimal 52 MINGGU TERBARU (yang tua dipangkas)
    const old = listWeekOptions([mkSession('b', '2024-01-05', [])], '2026-08-26')
    expect(old).toHaveLength(52)
    expect(old[0].start).toBe(weekWindow('2026-08-26').start)
    expect(old[51].start).toBe('2025-08-31') // tepat 51 minggu sebelum minggu berjalan
  })
})

describe('windows', () => {
  it('weekWindow mulai hari Minggu (konsisten chart)', () => {
    // 26 Agu 2026 = Rabu → minggu mulai 23 Agu (Minggu)
    const w = weekWindow('2026-08-26')
    expect(w.start).toBe('2026-08-23')
    expect(w.end).toBe('2026-08-29')
  })

  it('monthWindow batas bulan & tahun kabisat', () => {
    expect(monthWindow('2026-08-26').end).toBe('2026-08-31')
    expect(monthWindow('2024-02-10').end).toBe('2024-02-29') // kabisat
  })

  it('prevMonthWindow dari Januari → Desember tahun lalu', () => {
    const p = prevMonthWindow({ start: '2027-01-01', end: '2027-01-31' })
    expect(p.start).toBe('2026-12-01')
    expect(p.end).toBe('2026-12-31')
  })

  it('prevWeekWindow geser tepat 7 hari', () => {
    const p = prevWeekWindow(WIN)
    expect(p.start).toBe('2026-08-17')
    expect(p.end).toBe('2026-08-23')
  })
})

describe('formatPeriodForAI', () => {
  it('periode kosong', () => {
    const out = formatPeriodForAI({ sessions: [], exercises, bodyweights: [], window: WIN })
    expect(out).toContain('Tidak ada sesi selesai dalam periode ini.')
  })

  it('agregasi sesi selesai saja + total + per otot + per gerakan', () => {
    const s1 = mkSession('a', '2026-08-25', [
      { id: 'x1', exerciseId: 'squat', setNumber: 1, weightKg: 100, reps: 5 },
      { id: 'x2', exerciseId: 'squat', setNumber: 2, weightKg: 100, reps: 5 },
    ])
    const s2 = mkSession('b', '2026-08-27', [
      { id: 'y1', exerciseId: 'bench', setNumber: 1, weightKg: 60, reps: 5 },
      { id: 'y2', exerciseId: 'tread', setNumber: 1, weightKg: 0, reps: 0, durationSec: 1200, distanceKm: 3.2 },
    ], { planName: 'Push Day' })
    const running = mkSession('z', '2026-08-28', [{ id: 'z1', exerciseId: 'squat', setNumber: 1, weightKg: 999, reps: 5 }], { endedAt: null })

    const out = formatPeriodForAI({ sessions: [s1, s2, running], exercises, bodyweights: [], window: WIN })
    expect(out).toContain('Rekap Mingguan Latihan — 24–30 Agu 2026')
    expect(out).toContain('Sesi selesai: 2 (Leg Day · Push Day)')
    expect(out).toContain('- Kaki: 1000 kg')
    expect(out).toContain('- Dada: 300 kg')
    expect(out).toContain('Treadmill — 1 set · 20 mnt · 3,2 km')
    expect(out).toContain('terbaik 100kg×5')
    expect(out).not.toContain('999') // sesi berjalan tidak dihitung
  })

  it('delta volume vs periode lalu: naik / turun / baru', () => {
    const cur = mkSession('c', '2026-08-26', [
      { id: 'c1', exerciseId: 'squat', setNumber: 1, weightKg: 100, reps: 5 }, // vol 500
      { id: 'c2', exerciseId: 'bench', setNumber: 1, weightKg: 60, reps: 5 }, // vol 300
    ])
    const old = mkSession('o', '2026-08-18', [
      { id: 'o1', exerciseId: 'squat', setNumber: 1, weightKg: 90, reps: 5 }, // vol 450
    ])

    const out = formatPeriodForAI({
      sessions: [cur, old], exercises, bodyweights: [], window: WIN, prev: PREV,
    })
    expect(out).toMatch(/Squat[^\n]*↑50 kg vs periode lalu/)
    expect(out).toMatch(/Bench Press[^\n]*baru periode ini/)
  })

  it('berat badan: ≥2 entri → delta; 1 entri → nilai tunggal', () => {
    const bw: Bodyweight[] = [
      { id: '2026-08-24', date: '2026-08-24', kg: 70.2 },
      { id: '2026-08-29', date: '2026-08-29', kg: 69.8 },
    ]
    const s = mkSession('a', '2026-08-25', [{ id: 'x', exerciseId: 'squat', setNumber: 1, weightKg: 100, reps: 5 }])
    let out = formatPeriodForAI({ sessions: [s], exercises, bodyweights: bw, window: WIN })
    expect(out).toContain('Berat badan: 70,2 → 69,8 kg (−0,4)')

    out = formatPeriodForAI({ sessions: [s], exercises, bodyweights: [bw[0]], window: WIN })
    expect(out).toContain('Berat badan: 70,2 kg')
  })
})
