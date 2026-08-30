import { describe, it, expect } from 'vitest'
import { PLAN_PRESETS, presetByKey, presetByName, isRest, shortLabelFor, dotColorFor } from './templates'

describe('PLAN_PRESETS', () => {
  it('memiliki 6 preset: leg/push/pull/easy/cardio/rest', () => {
    const keys = PLAN_PRESETS.map(p => p.key).sort()
    expect(keys).toEqual(['cardio','easy','leg','pull','push','rest'])
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
