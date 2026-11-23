import { describe, it, expect } from 'vitest'
import { DEFAULT_EXERCISES } from './defaults'

describe('DEFAULT_EXERCISES', () => {
  it('Zottman Curl ada untuk seed akun baru', () => {
    const z = DEFAULT_EXERCISES.find((e) => e.name === 'Zottman Curl')
    expect(z).toEqual({
      name: 'Zottman Curl',
      muscleGroup: 'Bisep',
      equipment: 'Dumbbell',
      category: 'push',
      extraCategories: ['easy'],
    })
  })
})
