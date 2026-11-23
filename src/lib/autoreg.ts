// Mode autoregulasi — intensitas latihan ikut kondisi fisik hari itu,
// bukan skema 5/3/1 yang kaku. Dipakai saat shift bikin recovery tidak
// menentu: habis shift malam → Ringan, badan segar → Berat.
//
// Beban awal tiap gerakan dihitung dari set terbaik yang pernah tercatat
// (bestSetResult), dikali faktor intensitas — bukan dari Training Max.
import type { AutoIntensity } from '../types'

export interface AutoIntensityOption {
  key: AutoIntensity
  label: string
  rpe: string
  desc: string
  /** Pengali beban awal terhadap set terbaik sebelumnya. */
  factor: number
}

export const AUTO_INTENSITIES: AutoIntensityOption[] = [
  {
    key: 'light',
    label: 'Ringan',
    rpe: 'RPE 6',
    desc: 'Habis shift malam / badan capek',
    factor: 0.8,
  },
  {
    key: 'medium',
    label: 'Sedang',
    rpe: 'RPE 7–8',
    desc: 'Kondisi normal',
    factor: 0.9,
  },
  {
    key: 'heavy',
    label: 'Berat',
    rpe: 'RPE 8–9',
    desc: 'Badan segar, recovery cukup',
    factor: 1,
  },
]

export function autoIntensityOf(key: AutoIntensity): AutoIntensityOption {
  return AUTO_INTENSITIES.find((o) => o.key === key) ?? AUTO_INTENSITIES[1]
}

/** Beban awal dari set terbaik sebelumnya, dibulatkan ke 0,5 kg terdekat. */
export function autoPrefillWeight(bestKg: number, intensity: AutoIntensity): number {
  if (!(bestKg > 0)) return 0
  const factor = autoIntensityOf(intensity).factor
  return Math.round(bestKg * factor * 2) / 2
}
