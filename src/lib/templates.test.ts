import { describe, it, expect } from 'vitest'
import { PLAN_PRESETS, presetByKey, presetByName, presetByLooseName, stripSticker, isRest, isRestLoose, shortLabelFor, dotColorFor, baseCategoryForPresetKey, typeForPresetExercise } from './templates'

describe('PLAN_PRESETS', () => {
  it('memiliki 9 preset: leg/push/pull/easy/cardio/rest + rehab (leg-iso/leg-light/upper-r)', () => {
    const keys = PLAN_PRESETS.map(p => p.key).sort()
    expect(keys).toEqual(['cardio','easy','leg','leg-iso','leg-light','pull','push','rest','upper-r'])
  })
})

describe('presetByKey / presetByName', () => {
  it('byKey menemukan', () => {
    expect(presetByKey('leg')?.name).toBe('Lower')
    expect(presetByKey('rest')?.name).toBe('Rest Day')
  })
  it('byKey unknown → undefined', () => {
    expect(presetByKey('unknown')).toBeUndefined()
  })
  it('byName menemukan', () => {
    expect(presetByName('Arm & Shoulder')?.key).toBe('push')
    expect(presetByName('Push Day')?.key).toBe('push') // nama lama tetap resolve
  })
  it('byName unknown → undefined', () => {
    expect(presetByName('Tidak Ada')).toBeUndefined()
  })
})

describe('isRest', () => {
  it('Rest Day → true', () => {
    expect(isRest('Rest Day')).toBe(true)
  })
  it('leg/push/pull → false', () => {
    expect(isRest('Leg Day')).toBe(false)
    expect(isRest('Push Day')).toBe(false)
    expect(isRest('Cardio')).toBe(false)
  })
  it('case-sensitive? preset name exact → false bila beda case', () => {
    expect(isRest('rest day')).toBe(false)
  })
})

describe('isRestLoose', () => {
  it('Rest Day kanonis → true', () => {
    expect(isRestLoose('Rest Day')).toBe(true)
  })
  it('Rest berstiker siklus → tetap true (bug 13 Okt)', () => {
    expect(isRestLoose('[C5-S05] Rest Day — 3×3')).toBe(true)
  })
  it('workout berstiker → false', () => {
    expect(isRestLoose('[C1-S01] Leg Day — 3×5')).toBe(false)
    expect(isRestLoose('Leg Day')).toBe(false)
  })
})

describe('baseCategoryForPresetKey / typeForPresetExercise', () => {
  it('key standar = key itu sendiri', () => {
    expect(baseCategoryForPresetKey('leg', 'Kaki')).toBe('leg')
    expect(baseCategoryForPresetKey('cardio', 'Cardio')).toBe('cardio')
  })
  it('key rehab dipetakan ke tab library (bukan key mentah)', () => {
    expect(baseCategoryForPresetKey('leg-iso', 'Kaki')).toBe('leg')
    expect(baseCategoryForPresetKey('leg-light', 'Kaki')).toBe('leg')
    expect(baseCategoryForPresetKey('upper-r', 'Dada')).toBe('push')
    expect(baseCategoryForPresetKey('upper-r', 'Punggung')).toBe('pull')
  })
  it('iso + cardio = durasi, sisanya reps', () => {
    expect(typeForPresetExercise('Isometrik Quad 60°', 'Kaki')).toBe('duration')
    expect(typeForPresetExercise('Jalan Kaki', 'Cardio')).toBe('duration')
    expect(typeForPresetExercise('Treadmill', 'Cardio')).toBe('duration')
    expect(typeForPresetExercise('Leg Curl', 'Kaki')).toBe('reps')
  })
})

describe('shortLabelFor / dotColorFor', () => {
  it('shortLabelFor', () => {
    expect(shortLabelFor('Lower')).toBe('LOW')
    expect(shortLabelFor('Leg Day')).toBe('LOW') // nama lama
    expect(shortLabelFor('Arm & Shoulder')).toBe('ARM')
    expect(shortLabelFor('Push Day')).toBe('ARM') // nama lama
    expect(shortLabelFor('Tidak Ada')).toBe('')
  })
  it('dotColorFor', () => {
    expect(dotColorFor('Lower')).toBe('#44cc88')
    expect(dotColorFor('Tidak Ada')).toBeUndefined()
  })
  it('nama berstiker tetap ter-resolve (Fase 1)', () => {
    expect(shortLabelFor('[C1-S01] Leg Day — 3×5')).toBe('LOW')
    expect(shortLabelFor('[C1-S01] [C1-S01] Leg Day — 3×5 — 3×5')).toBe('LOW')
    expect(dotColorFor('[C1-S02] Push — 3×5')).toBe('#6699ff')
  })
})

// Fase 1 — planName berstiker: kupas stiker jadi nama plan polos.
describe('stripSticker', () => {
  it('nama polos tidak berubah', () => {
    expect(stripSticker('Leg Day')).toBe('Leg Day')
    expect(stripSticker('Push Day')).toBe('Push Day')
  })
  it('kupas prefix + wave', () => {
    expect(stripSticker('[C1-S01] Leg Day — 3×5')).toBe('Leg Day')
    expect(stripSticker('[C1-S02] Push — 3×5')).toBe('Push')
  })
  it('kupas label ganda (bug tombol Mulai)', () => {
    expect(stripSticker('[C1-S01] [C1-S01] Leg Day — 3×5 — 3×5')).toBe('Leg Day')
  })
  it('kupas stiker rehab', () => {
    expect(stripSticker('[R1-S05] Leg Rehab Iso — W2')).toBe('Leg Rehab Iso')
  })
})

describe('presetByLooseName', () => {
  it('nama polos tetap jalan', () => {
    expect(presetByLooseName('Leg Day')?.key).toBe('leg')
    expect(presetByLooseName('Push Day')?.key).toBe('push')
  })
  it('nama berstiker siklus ter-resolve', () => {
    expect(presetByLooseName('[C1-S01] Leg Day — 3×5')?.key).toBe('leg')
    expect(presetByLooseName('[C1-S01] [C1-S01] Leg Day — 3×5 — 3×5')?.key).toBe('leg')
  })
  it('label siklus "Push" (tanpa Day) ter-resolve ke Arm & Shoulder', () => {
    expect(presetByLooseName('[C1-S02] Push — 3×5')?.key).toBe('push')
    expect(presetByLooseName('Push')?.key).toBe('push')
  })
  it('unknown → undefined', () => {
    expect(presetByLooseName('[C1-S01] Tidak Ada — 3×5')).toBeUndefined()
  })
})

describe('rename split 23 Nov 2026 (key tetap, nama baru)', () => {
  it('nama baru per key', () => {
    expect(presetByKey('leg')?.name).toBe('Lower')
    expect(presetByKey('pull')?.name).toBe('Upper')
    expect(presetByKey('push')?.name).toBe('Arm & Shoulder')
    expect(presetByKey('easy')?.name).toBe('Full Body')
  })
  it('nama lama tetap resolve (data lama kepake)', () => {
    expect(presetByName('Leg Day')?.key).toBe('leg')
    expect(presetByName('Pull Day')?.key).toBe('pull')
    expect(presetByName('Easy Day')?.key).toBe('easy')
    expect(presetByLooseName('Pull Day')?.key).toBe('pull')
    expect(presetByLooseName('[C1-S01] Pull Day — 3×5')?.key).toBe('pull')
  })
  it('Upper berisi dada + punggung, Arm & Shoulder berisi bahu + lengan', () => {
    expect(presetByKey('pull')?.exercises.map((e) => e.name)).toContain('Bench Press')
    expect(presetByKey('pull')?.exercises.map((e) => e.name)).toContain('Barbell Row')
    expect(presetByKey('push')?.exercises.map((e) => e.name)).toContain('Overhead Press')
    expect(presetByKey('push')?.exercises.map((e) => e.name)).toContain('Bicep Curl DB')
    expect(presetByKey('push')?.exercises.map((e) => e.name)).not.toContain('Bench Press')
  })
})
