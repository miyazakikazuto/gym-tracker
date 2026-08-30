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
describe('suggestKey night-light & siang alias', () => {
  function mk(over: Partial<Session> = {}): Session {
    return { id: 'x', date: '2026-08-10', planId: null, planName: 'Leg Day', note: '', startedAt: 1, endedAt: 2, sets: [], ...over } as Session
  }
  it('malam → easy (night-light)', () => {
    const sessions = [mk({ planName: 'Leg Day', date: '2026-08-10' })]
    // rotasi default setelah Leg adalah easy, tapi bila next adalah push dan shift malam, should lighten ke easy
    const r = suggestKey({}, sessions, 'malam')
    // setup: last is Leg → next is easy → isNightLight false karena key sudah easy
    expect(r.isNightLight).toBe(false)
    // Now test dengan sesi last = Easy → next = Push, malam → isNightLight true
    const sessions2 = [mk({ planName: 'Easy Day', date: '2026-08-10' })]
    const r2 = suggestKey({}, sessions2, 'malam')
    expect(r2.key).toBe('easy')
    expect(r2.isNightLight).toBe(true)
  })
  it('pagi → tidak lighten', () => {
    const sessions = [{ id: 'x', date: '2026-08-10', planId: null, planName: 'Easy Day', note: '', startedAt: 1, endedAt: 2, sets: [] } as Session]
    const r = suggestKey({}, sessions, 'pagi')
    expect(r.isNightLight).toBe(false)
    expect(r.key).toBe('push')
  })
  it('siang alias ke sore tidak memicu night-light', () => {
    // shift siang should be treated as sore via shiftForDate, but suggestKey only checks 'malam'
    const r = suggestKey({}, [], 'sore')
    expect(r.isNightLight).toBe(false)
  })
})
