// e1RM (estimated 1 rep max) — rumus Epley: beban × (1 + reps/30).
// Satu sumber kebenaran: Progress (tren/PR) & Session (badge e1RM) memakai ini.
//
// Batas validitas: Epley hanya masuk akal s.d. 12 reps. Set di atas itu tidak
// diestimasi (0) supaya set AMRAP/reps tinggi tidak menggelembungkan tren, PR,
// saran Training Max, dan rekap AI. Set tetap tersimpan & tetap dihitung volume.
// Single (1 rep) = beban itu sendiri; Epley mentah menambah ~3% palsu.
export const E1RM_MAX_REPS = 12

export function e1rm(weightKg: number, reps: number): number {
  if (!(weightKg > 0) || !Number.isFinite(reps) || reps < 0) return 0
  if (reps <= 1) return weightKg
  if (reps > E1RM_MAX_REPS) return 0
  return weightKg * (1 + reps / 30)
}

export function e1rmStr(val: number): string {
  const r = Math.round(val * 2) / 2
  return r % 1 === 0 ? String(Math.round(r)) : r.toFixed(1)
}

export function e1rmKg(weightKg: number, reps: number): string {
  return e1rmStr(e1rm(weightKg, reps))
}
