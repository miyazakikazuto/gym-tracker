// e1RM (estimated 1 rep max) — rumus Epley sederhana: beban × (1 + reps/30).
// Satu sumber kebenaran: Progress (tren/PR) & Session (badge e1RM) memakai ini.
export function e1rm(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30)
}

export function e1rmStr(val: number): string {
  const r = Math.round(val * 2) / 2
  return r % 1 === 0 ? String(Math.round(r)) : r.toFixed(1)
}

export function e1rmKg(weightKg: number, reps: number): string {
  return e1rmStr(e1rm(weightKg, reps))
}
