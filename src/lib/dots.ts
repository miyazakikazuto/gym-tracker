// DOTS asli (Mike Tuchscherer) — versi 2022, koefisien polinomial derajat 4, pria.
// DOTS = total (kg) × koefisien(bodyweight)

const DOTS_MALE = { a: -0.000001022984, b: 0.0006963339, c: -0.1782608423, d: 22.4434844, e: -281.97485 }

export function dotsCoefficient(bw: number): number {
  const c = DOTS_MALE
  const denom = c.a * bw ** 4 + c.b * bw ** 3 + c.c * bw ** 2 + c.d * bw + c.e
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