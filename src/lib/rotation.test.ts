import { describe, it, expect } from 'vitest'
import {
  rotationOf,
  lastFinishedSession,
  daysSinceLast,
  suggestKey,
} from './rotation'
import type { Session } from '../types'

function mkSession(over: Partial<Session> = {}): Session {
  return {
    id: 's1',
    date: '2026-08-20',
    planId: null,
    planName: 'Leg Day',
    note: '',
    startedAt: 0,
    endedAt: 1000,
    sets: [],
    ...over,
  }
}

const DAY_MS = 86_400_000

describe('lastFinishedSession', () => {
  it('kosong → null', () => {
    expect(lastFinishedSession([])).toBeNull()
  })

  it('abaikan sesi belum selesai', () => {
    expect(lastFinishedSession([mkSession({ endedAt: null })])).toBeNull()
  })

  it('abaikan Rest Day walau selesai', () => {
    expect(lastFinishedSession([mkSession({ planName: 'Rest Day' })])).toBeNull()
  })

  it('pilih tanggal terbaru; tie-break startedAt', () => {
    const older = mkSession({ id: 'a', date: '2026-08-18', planName: 'Push Day' })
    const newer = mkSession({ id: 'b', date: '2026-08-20', planName: 'Pull Day' })
    expect(lastFinishedSession([older, newer])?.id).toBe('b')

    const early = mkSession({ id: 'c', date: '2026-08-20', startedAt: DAY_MS })
    const late = mkSession({ id: 'd', date: '2026-08-20', startedAt: 2 * DAY_MS })
    expect(lastFinishedSession([early, late])?.id).toBe('d')
  })
})

describe('daysSinceLast', () => {
  it('belum pernah latihan → null', () => {
    expect(daysSinceLast([], '2026-08-25')).toBeNull()
  })

  it('latihan hari ini → 0 (tidak negatif)', () => {
    expect(daysSinceLast([mkSession({ date: '2026-08-25' })], '2026-08-25')).toBe(0)
  })

  it('selisih N hari', () => {
    const s = mkSession({ date: '2026-08-22' })
    expect(daysSinceLast([s], '2026-08-25')).toBe(3)
  })

  it('hanya sesi Rest → tetap null', () => {
    const s = mkSession({ planName: 'Rest Day', date: '2026-08-24' })
    expect(daysSinceLast([s], '2026-08-25')).toBeNull()
  })
})

describe('rotationOf defaults', () => {
  it('tanpa settings → rotasi default & anchor default', () => {
    const r = rotationOf({})
    expect(r.rotation).toEqual(['leg', 'easy', 'push', 'pull'])
    expect(r.anchor).toBe('2026-08-12')
  })

  it('stale anchor 2026-08-15 diganti default', () => {
    expect(rotationOf({ shiftAnchor: '2026-08-15' }).anchor).toBe('2026-08-12')
  })
})

describe('suggestKey', () => {
  it('belum ada sesi → key pertama rotasi', () => {
    expect(suggestKey({}, []).key).toBe('leg')
  })

  it('lanjut dari sesi terakhir yang selesai', () => {
    // Leg Day selesai → berikutnya easy
    expect(suggestKey({}, [mkSession()]).key).toBe('easy')
    // Push Day selesai → berikutnya pull
    expect(suggestKey({}, [mkSession({ planName: 'Push Day' })]).key).toBe('pull')
  })

  it('sesi Rest tidak menggeser rotasi', () => {
    const done = suggestKey({}, [mkSession()])
    const withRest = suggestKey({}, [
      mkSession(),
      mkSession({ id: 'r', planName: 'Rest Day', date: '2026-08-21' }),
    ])
    expect(withRest.key).toBe(done.key)
  })

  it('planName tak dikenal → fallback key pertama', () => {
    expect(suggestKey({}, [mkSession({ planName: 'Sesi Bebas' })]).key).toBe('leg')
  })

  it('shift malam → diringankan ke easy + flag', () => {
    const r = suggestKey({}, [], 'malam')
    expect(r.key).toBe('easy')
    expect(r.isNightLight).toBe(true)
  })

  it('next key sudah easy di shift malam → flag false', () => {
    // Leg Day selesai → next = easy; night-light tidak menimpa apa pun
    const r = suggestKey({}, [mkSession()], 'malam')
    expect(r.key).toBe('easy')
    expect(r.isNightLight).toBe(false)
  })

  it('shift lain tidak menimpa saran', () => {
    const r = suggestKey({}, [], 'pagi')
    expect(r.key).toBe('leg')
    expect(r.isNightLight).toBe(false)
  })
})
