// DOTS (Mike Tuchscherer / OpenPowerlifting) — koefisien polinomial derajat 4, pria.
// DOTS = total (kg) × koefisien(bodyweight), koefisien = 500 / D(BW)
// Koefisien disesuaikan dengan standar publikasi resmi (verifikasi lintas sumber).
// Catatan: app hanya mendukung koefisien pria — belum ada setting jenis kelamin.

/** Koefisien pria saja — tidak ada `UserSettings.gender`; jangan pakai untuk BW wanita. */
const DOTS_MALE = { a: -0.000001093, b: 0.0007391293, c: -0.1918759221, d: 24.0900756, e: -307.75076 }
// Rentang valid bodyweight pria — di luar ini dijepret ke batas (polinomial tidak di-fit untuk BW ekstrem)
const BW_MIN = 40
const BW_MAX = 210

function dotsCoefficient(bw: number): number {
  const c = DOTS_MALE
  const x = Math.min(BW_MAX, Math.max(BW_MIN, bw))
  const denom = c.a * x ** 4 + c.b * x ** 3 + c.c * x ** 2 + c.d * x + c.e
  return 500 / denom
}

export function dotsScore(totalKg: number, bw: number): number {
  return totalKg * dotsCoefficient(bw)
}

export function fmtDots(score: number): string {
  const r = Math.round(score * 10) / 10
  return r % 1 === 0 ? String(Math.round(r)) : r.toFixed(1)
}

// Klasifikasi level DOTS (referensi umum):
// Pemula <250 · Novis 250+ · Menengah 300+ · Lanjut 350+ · Elit 400+
export function dotsLevel(score: number): { label: string; color: string } | null {
  if (!(score > 0)) return null
  if (score >= 400) return { label: 'Elit', color: '#fbbf24' }
  if (score >= 350) return { label: 'Lanjut', color: '#a78bfa' }
  if (score >= 300) return { label: 'Menengah', color: '#60a5fa' }
  if (score >= 250) return { label: 'Novis', color: '#4ade80' }
  return { label: 'Pemula', color: 'var(--muted)' }
}