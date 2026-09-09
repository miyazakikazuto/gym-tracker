import { describe, it, expect } from 'vitest'
import { PLAN_PRESETS, presetByKey, presetByName, isRest, shortLabelFor, dotColorFor, baseCategoryForPresetKey, typeForPresetExercise } from './templates'

describe('PLAN_PRESETS', () => {
  it('memiliki 9 preset: leg/push/pull/easy/cardio/rest + rehab (leg-iso/leg-light/upper-r)', () => {
    const keys = PLAN_PRESETS.map(p => p.key).sort()
    expect(keys).toEqual(['cardio','easy','leg','leg-iso','leg-light','pull','push','rest','upper-r'])
  })
})

describe('presetByKey / presetByName', () => {
  it('byKey menemukan', () => {
    expect(presetByKey('leg')?.name).toBe('Leg Day')
    expect(presetByKey('rest')?.name).toBe('Rest Day')
  })
  it('byKey unknown → undefined', () => {
    expect(presetByKey('unknown')).toBeUndefined()
  })
  it('byName menemukan', () => {
    expect(presetByName('Push Day')?.key).toBe('push')
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
    expect(shortLabelFor('Leg Day')).toBe('LEG')
    expect(shortLabelFor('Push Day')).toBe('PUSH')
    expect(shortLabelFor('Tidak Ada')).toBe('')
  })
  it('dotColorFor', () => {
    expect(dotColorFor('Leg Day')).toBe('#44cc88')
    expect(dotColorFor('Tidak Ada')).toBeUndefined()
  })
})
