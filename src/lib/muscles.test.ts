import { describe, it, expect } from 'vitest'
import { secondaryFactorsFor } from './muscles'

describe('secondaryFactorsFor', () => {
  it('kosong → []', () => {
    expect(secondaryFactorsFor('')).toEqual([])
    expect(secondaryFactorsFor('   ')).toEqual([])
  })
  it('case-insensitive & trim', () => {
    expect(secondaryFactorsFor('  BENCH PRESS ')).toEqual([{ group: 'Trisep', factor: 0.5 }, { group: 'Bahu', factor: 0.3 }])
  })
  it('first-match-wins: reverse hack squat sebelum hack squat', () => {
    const r = secondaryFactorsFor('reverse hack squat')
    expect(r).toEqual([{ group: 'Punggung', factor: 0.2 }, { group: 'Core', factor: 0.3 }])
    const h = secondaryFactorsFor('hack squat')
    expect(h).toEqual([{ group: 'Punggung', factor: 0.1 }, { group: 'Core', factor: 0.2 }])
  })
  it('hack squat sebelum squat', () => {
    expect(secondaryFactorsFor('hack squat machine')).toEqual(expect.arrayContaining([{ group: 'Core', factor: 0.2 }]))
    expect(secondaryFactorsFor('barbell squat')).toEqual([{ group: 'Punggung', factor: 0.3 }, { group: 'Core', factor: 0.4 }])
  })
  it('incline bench sebelum bench press', () => {
    expect(secondaryFactorsFor('incline bench press')).toEqual([{ group: 'Bahu', factor: 0.4 }, { group: 'Trisep', factor: 0.4 }])
    expect(secondaryFactorsFor('bench press')).toEqual([{ group: 'Trisep', factor: 0.5 }, { group: 'Bahu', factor: 0.3 }])
  })
  it('unknown pattern → []', () => {
    expect(secondaryFactorsFor('unknown exercise xyz')).toEqual([])
  })
  it('leg curl → [] (isolasi)', () => {
    expect(secondaryFactorsFor('leg curl')).toEqual([])
  })
  it('bicep curl → Forearm 0.3', () => {
    expect(secondaryFactorsFor('bicep curl')).toEqual([{ group: 'Forearm', factor: 0.3 }])
  })
  it('deadlift spesifik: sumo vs romanian vs conventional', () => {
    expect(secondaryFactorsFor('sumo deadlift')).toEqual([{ group: 'Punggung', factor: 0.4 }, { group: 'Core', factor: 0.3 }])
    expect(secondaryFactorsFor('romanian deadlift')).toEqual([{ group: 'Punggung', factor: 0.4 }, { group: 'Core', factor: 0.3 }])
    expect(secondaryFactorsFor('deadlift')).toEqual([{ group: 'Punggung', factor: 1.0 }, { group: 'Core', factor: 0.4 }])
  })
  it('push patterns: dips, fly, overhead press', () => {
    expect(secondaryFactorsFor('dips')).toEqual(expect.arrayContaining([{ group: 'Dada', factor: 0.5 }]))
    expect(secondaryFactorsFor('overhead press')).toEqual([{ group: 'Trisep', factor: 0.5 }, { group: 'Dada', factor: 0.2 }])
  })
})
