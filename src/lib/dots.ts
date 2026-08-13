export type Sex = 'male' | 'female'

// DOTS asli (Mike Tuchscherer) — koefisien polinomial derajat 4 per sex.
// DOTS = total (kg) × koefisien(bodyweight)

const DOTS_MALE = { a: -0.000001093, b: 0.0007391293, c: -0.1918759221, d: 24.0900756, e: -307.75076 }
const DOTS_FEMALE = { a: -0.0000010706, b: 0.0005158568, c: -0.092771172, d: 6.390053, e: -199.58829 }

export function dotsCoefficient(bw: number, sex: Sex): number {
  const c = sex === 'female' ? DOTS_FEMALE : DOTS_MALE
  const denom = c.a * bw ** 4 + c.b * bw ** 3 + c.c * bw ** 2 + c.d * bw + c.e
  return 500 / denom
}

export function dotsScore(totalKg: number, bw: number, sex: Sex): number {
  return totalKg * dotsCoefficient(bw, sex)
}

export function fmtDots(score: number): string {
  const r = Math.round(score * 10) / 10
  return r % 1 === 0 ? String(Math.round(r)) : r.toFixed(1)
}
