import { describe, it, expect } from 'vitest'
import {
  rotationOf,
  lastFinishedSession,
  daysSinceLast,
  suggestKey,
  weekProgressFreeOrder,
  freeNextKey,
  planForKey,
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
    expect(r.rotation).toEqual(['leg', 'pull', 'push'])
    expect(r.anchor).toBe('2026-08-12')
  })

  it('rotasi default lama dimigrasi ke urutan baru; yang sudah diubah sendiri tidak disentuh', () => {
    expect(rotationOf({ rotation: ['leg', 'easy', 'push', 'pull'] }).rotation).toEqual(['leg', 'pull', 'push'])
    expect(rotationOf({ rotation: ['pull', 'leg', 'push'] }).rotation).toEqual(['pull', 'leg', 'push'])
  })

  it('Full Body tidak pernah masuk rotasi (cuma volume/maintain, bukan hari rutin)', () => {
    expect(rotationOf({}).rotation).not.toContain('easy')
    expect(rotationOf({ rotation: ['leg', 'pull', 'push', 'easy'] }).rotation).toEqual(['leg', 'pull', 'push'])
    expect(rotationOf({ rotation: ['easy'] }).rotation).toEqual(['leg', 'pull', 'push'])
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
    // Lower selesai → berikutnya Upper
    expect(suggestKey({}, [mkSession()]).key).toBe('pull')
    // Arm & Shoulder selesai → balik ke Lower (rotasi 3 hari)
    expect(suggestKey({}, [mkSession({ planName: 'Push Day' })]).key).toBe('leg')
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

  it('shift malam → diringankan ke Upper + flag', () => {
    const r = suggestKey({}, [], 'malam')
    expect(r.key).toBe('pull')
    expect(r.isNightLight).toBe(true)
  })

  it('next key sudah Upper di shift malam → flag false', () => {
    // Lower selesai → next = Upper; night-light tidak menimpa apa pun
    const r = suggestKey({}, [mkSession()], 'malam')
    expect(r.key).toBe('pull')
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
  it('malam → Upper (night-light)', () => {
    const sessions = [mk({ planName: 'Leg Day', date: '2026-08-10' })]
    // rotasi default setelah Lower adalah Upper, tapi bila next bukan Upper dan shift malam, should lighten ke Upper
    const r = suggestKey({}, sessions, 'malam')
    // setup: last is Lower → next is Upper → isNightLight false karena key sudah Upper
    expect(r.isNightLight).toBe(false)
    // Now test dengan sesi last = Full Body → next = Lower, malam → isNightLight true
    const sessions2 = [mk({ planName: 'Easy Day', date: '2026-08-10' })]
    const r2 = suggestKey({}, sessions2, 'malam')
    expect(r2.key).toBe('pull')
    expect(r2.isNightLight).toBe(true)
  })
  it('pagi → tidak lighten', () => {
    const sessions = [{ id: 'x', date: '2026-08-10', planId: null, planName: 'Easy Day', note: '', startedAt: 1, endedAt: 2, sets: [] } as Session]
    const r = suggestKey({}, sessions, 'pagi')
    expect(r.isNightLight).toBe(false)
    expect(r.key).toBe('leg')
  })
  it('siang alias ke sore tidak memicu night-light', () => {
    // shift siang should be treated as sore via shiftForDate, but suggestKey only checks 'malam'
    const r = suggestKey({}, [], 'sore')
    expect(r.isNightLight).toBe(false)
  })
})

describe('weekProgressFreeOrder (kalender Senin–Minggu)', () => {
  // Minggu acuan: Senin 2026-09-21 – Minggu 2026-09-27 (24 = Kamis)
  const since = { freeOrderSince: '2026-09-21' }
  const REF = '2026-09-24'
  const seq = (pairs: [string, string][]) =>
    pairs.map(([planName, date], i) =>
      mkSession({ id: `s${i}`, planName, date, startedAt: i, endedAt: i + 1 }),
    )
  const prog = (pairs: [string, string][], refToday = REF, s = since) =>
    weekProgressFreeOrder(seq(pairs), new Set(), 0, s, refToday)

  it('kosong → Week-1 0/3', () => {
    const r = prog([])
    expect(r).toMatchObject({ cycle: 1, progress: '0/3', isWeekComplete: false })
    expect(r.doneKeys.size).toBe(0)
  })

  it('Pull+Push minggu ini → 2/3 (kehitung, tidak kejebak grup lama)', () => {
    const r = prog([['Pull Day', '2026-09-22'], ['Push Day', '2026-09-23']])
    expect(r).toMatchObject({ cycle: 1, progress: '2/3', isWeekComplete: false })
    expect(r.doneKeys).toEqual(new Set(['pull', 'push']))
  })

  it('full week → 3/3 komplet (tampil s/d Minggu)', () => {
    const r = prog([['Pull Day', '2026-09-22'], ['Push Day', '2026-09-23'], ['Leg Day', '2026-09-24']])
    expect(r).toMatchObject({ cycle: 1, progress: '3/3', isWeekComplete: true })
    expect(r.doneKeys).toEqual(new Set(['pull', 'push', 'leg']))
  })

  it('Senin berikut reset 0/3 (week lalu tak komplet hangus)', () => {
    const r = prog(
      [['Pull Day', '2026-09-22'], ['Push Day', '2026-09-23']],
      '2026-09-28',
    )
    expect(r).toMatchObject({ cycle: 2, progress: '0/3', isWeekComplete: false })
    expect(r.doneKeys.size).toBe(0)
  })

  it('week komplet lalu Senin reset (tidak macet di 3/3)', () => {
    const full: [string, string][] = [['Pull Day', '2026-09-22'], ['Push Day', '2026-09-23'], ['Leg Day', '2026-09-24']]
    expect(prog(full, '2026-09-27').isWeekComplete).toBe(true)
    const r = prog(full, '2026-09-28')
    expect(r).toMatchObject({ cycle: 2, progress: '0/3', isWeekComplete: false })
  })

  it('sesi minggu lalu diabaikan', () => {
    const r = prog([['Pull Day', '2026-09-15'], ['Push Day', '2026-09-16']])
    expect(r).toMatchObject({ cycle: 1, progress: '0/3' })
    expect(r.doneKeys.size).toBe(0)
  })

  it('duplicate tidak ganda: Pull 2× tetap 1 key', () => {
    const r = prog([['Pull Day', '2026-09-22'], ['Pull Day', '2026-09-23'], ['Push Day', '2026-09-24']])
    expect(r).toMatchObject({ cycle: 1, progress: '2/3' })
    expect(r.doneKeys).toEqual(new Set(['pull', 'push']))
  })

  it('batas Minggu: sesi Minggu 27 kehitung, Senin 28 masuk week baru', () => {
    const r = prog([['Leg Day', '2026-09-27']], '2026-09-27')
    expect(r.doneKeys).toEqual(new Set(['leg']))
    const r2 = prog([['Leg Day', '2026-09-28']], '2026-09-28')
    expect(r2).toMatchObject({ cycle: 2, progress: '1/3' })
    expect(r2.doneKeys).toEqual(new Set(['leg']))
  })

  it('nomor week dari jangkar: anchor 2 minggu lalu → cycle 3', () => {
    const r = prog([['Pull Day', '2026-09-24']], REF, { freeOrderSince: '2026-09-07' })
    expect(r).toMatchObject({ cycle: 3, progress: '1/3' })
  })

  it('tanpa jangkar → cycle 1 (anchor = minggu berjalan)', () => {
    const r = weekProgressFreeOrder(seq([['Pull Day', '2026-09-24']]), new Set(), 0, {}, REF)
    expect(r).toMatchObject({ cycle: 1, progress: '1/3' })
  })
})

describe('freeNextKey', () => {
  it('kosong → pull; berkurang sesuai sisa; penuh → null', () => {
    expect(freeNextKey(new Set())).toBe('pull')
    expect(freeNextKey(new Set(['pull']))).toBe('push')
    expect(freeNextKey(new Set(['pull', 'push']))).toBe('leg')
    expect(freeNextKey(new Set(['pull', 'push', 'leg']))).toBeNull()
  })
})

describe('planForKey (nama lama tetap kepake)', () => {
  const plans = [
    { id: 'p1', name: 'Leg Day', dayOfWeek: null as number | null, items: [] },
    { id: 'p2', name: 'Full Body', dayOfWeek: null as number | null, items: [] },
  ]
  it('plan nama lama ketemu untuk key baru', () => {
    expect(planForKey(plans as never, 'leg')?.id).toBe('p1')
  })
  it('plan nama baru ketemu', () => {
    expect(planForKey(plans as never, 'easy')?.id).toBe('p2')
  })
})
