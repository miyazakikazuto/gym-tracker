import { describe, it, expect } from 'vitest'
import { EXERCISE_CATEGORIES } from './types'

describe('EXERCISE_CATEGORIES (label library ikut nama split baru)', () => {
  it('nama & shortLabel pakai nama split baru, key tidak berubah', () => {
    expect(EXERCISE_CATEGORIES.map((c) => [c.key, c.name, c.shortLabel])).toEqual([
      ['leg', 'Lower', 'LOW'],
      ['push', 'Arm & Shoulder', 'ARM'],
      ['pull', 'Upper', 'UPP'],
      ['easy', 'Full Body', 'FULL'],
      ['cardio', 'Cardio', 'CARDIO'],
    ])
  })
})
