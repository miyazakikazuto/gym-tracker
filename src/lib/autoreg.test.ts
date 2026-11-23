import { describe, it, expect } from 'vitest'
import { AUTO_INTENSITIES, autoIntensityOf, autoPrefillWeight } from './autoreg'

describe('AUTO_INTENSITIES', () => {
  it('tiga pilihan: Ringan / Sedang / Berat', () => {
    expect(AUTO_INTENSITIES.map((o) => o.key)).toEqual(['light', 'medium', 'heavy'])
    expect(AUTO_INTENSITIES.map((o) => o.label)).toEqual(['Ringan', 'Sedang', 'Berat'])
  })
  it('faktor naik seiring intensitas', () => {
    expect(AUTO_INTENSITIES[0].factor).toBeLessThan(AUTO_INTENSITIES[1].factor)
    expect(AUTO_INTENSITIES[1].factor).toBeLessThan(AUTO_INTENSITIES[2].factor)
  })
})

describe('autoIntensityOf', () => {
  it('kenal semua key', () => {
    expect(autoIntensityOf('light').label).toBe('Ringan')
    expect(autoIntensityOf('medium').label).toBe('Sedang')
    expect(autoIntensityOf('heavy').label).toBe('Berat')
  })
})

describe('autoPrefillWeight', () => {
  it('skala dari set terbaik: 100 kg → 80 / 90 / 100', () => {
    expect(autoPrefillWeight(100, 'light')).toBe(80)
    expect(autoPrefillWeight(100, 'medium')).toBe(90)
    expect(autoPrefillWeight(100, 'heavy')).toBe(100)
  })
  it('dibulatkan ke 0,5 kg terdekat', () => {
    // 87,5 × 0,9 = 78,75 → 79? tidak — 78,75 × 2 = 157,5 → round 158 / 2 = 79
    expect(autoPrefillWeight(87.5, 'medium')).toBe(79)
    expect(autoPrefillWeight(42.5, 'light')).toBe(34)
  })
  it('tanpa riwayat (0) → 0, bukan beban ngawur', () => {
    expect(autoPrefillWeight(0, 'heavy')).toBe(0)
    expect(autoPrefillWeight(-5, 'medium')).toBe(0)
  })
})
