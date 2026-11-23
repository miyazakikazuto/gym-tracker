import type { Exercise, Session, SessionSet } from '../types'
import { isRestLoose } from './templates'
import { volumeOf } from './date'

export function getExerciseName(exercises: Exercise[], id: string): string {
  return exercises.find((e) => e.id === id)?.name ?? `[Terhapus ${id.slice(0, 6)}]`
}

const MUSCLE_TO_CATEGORY: Record<string, string> = {
  Dada: 'push',
  Trisep: 'push',
  Bahu: 'push',
  Punggung: 'pull',
  Bisep: 'pull',
  Forearm: 'pull',
  Kaki: 'leg',
  Cardio: 'cardio',
  Core: 'easy',
  Lainnya: 'easy',
}

export function categoryOfExercise(ex: { category?: string; muscleGroup: string }): string {
  // Prioritas: category eksplisit → mapping muscleGroup → fallback 'push'.
  // Alias 'home' dianggap 'easy' (kategori lama). MuscleGroup kosong → fallback 'push'.
  const c = ex.category || MUSCLE_TO_CATEGORY[ex.muscleGroup] || 'push'
  return c === 'home' ? 'easy' : c
}

/**
 * True bila sesi dihitung dalam siklus 5/3/1 dan rotasi.
 * Kebalikan dari sesi non-counting: belum selesai, extra, Rest Day, Cardio, Skip, atau Rehab.
 * Disatukan di sini agar `progression.ts` dan `rotation.ts` tidak divergen.
 * 6 predikat: endedAt null, isExtra, isRest(planName), /cardio/i, /^skip/i, rehab ([R..] / preset rehab).
 */
export function isCountedSession(s: Session): boolean {
  if (s.endedAt === null) return false
  if (s.isExtra) return false
  if (isRestLoose(s.planName)) return false
  if (/cardio/i.test(s.planName)) return false
  if (/^skip/i.test(s.planName.trim())) return false
  // Rehab: [R1-S01]… atau preset rehab tanpa stiker — jangan hitung di siklus 5/3/1
  if (s.cycleLabel?.startsWith('[R')) return false
  const key = s.planName.trim().toLowerCase()
  if (key === 'leg rehab iso' || key === 'leg ringan' || key === 'upper kanan') return false
  return true
}

/**
 * Patch kanonis untuk sesi Rest: nama bersih tanpa stiker, bukan extra,
 * langsung selesai, tanpa set. Idempoten — return {} bila sudah kanonis
 * atau bukan rest (cek longgar: stiker "[C5-S05] Rest — 3×3" ikut kena).
 * Field snapshot 5/3/1 (cycleLabel/scheme/…) dihapus pemanggil via deleteField.
 */
export function normalizeRestSession(s: Session): Partial<Session> {
  if (!isRestLoose(s.planName)) return {}
  const patch: Partial<Session> = {}
  if (s.planName !== 'Rest') patch.planName = 'Rest'
  if (s.isExtra === true) patch.isExtra = false
  if (s.endedAt === null) patch.endedAt = s.startedAt
  if (s.sets.length > 0) patch.sets = []
  return patch
}

export function categoryKeysOfExercise(ex: Exercise): string[] {
  const keys = [categoryOfExercise(ex), ...(ex.extraCategories ?? [])]
  return keys.filter((k, i) => keys.indexOf(k) === i)
}

export function exerciseIsDuration(exercises: Exercise[], exerciseId: string): boolean {
  return exercises.find((e) => e.id === exerciseId)?.type === 'duration'
}
export function bestSetResult(
  sessions: Session[],
  excludeId: string,
  exerciseId: string,
): { weightKg: number; reps: number; durationSec?: number; distanceKm?: number; elevationM?: number } | null {
  // Pilih set terbaik: primary = weightKg >0 ? weightKg : distanceKm>0 ? distanceKm : durationSec ??0
  // Set tanpa data (weightKg===0 && durationSec==null && distanceKm==0) dilewati via guard hasData.
  // Tie-break: s.date terbaru menang.
  let best: { primary: number; weightKg: number; reps: number; durationSec?: number; distanceKm?: number; elevationM?: number; date: string } | null = null
  for (const s of sessions) {
    if (s.id === excludeId || s.endedAt === null) continue
    for (const set of s.sets) {
      if (set.exerciseId !== exerciseId) continue
      const hasData = set.weightKg > 0 || set.durationSec != null || (set.distanceKm ?? 0) > 0
      if (!hasData) continue
      const km = set.distanceKm ?? 0
      const primary: number = set.weightKg > 0 ? set.weightKg : km > 0 ? km : set.durationSec ?? 0
      if (!best || primary > best.primary || (primary === best.primary && s.date > best.date)) {
        best = { primary, weightKg: set.weightKg, reps: set.reps, durationSec: set.durationSec, distanceKm: set.distanceKm, elevationM: set.elevationM, date: s.date }
      }
    }
  }
  if (!best) return null
  return { weightKg: best.weightKg, reps: best.reps, durationSec: best.durationSec, distanceKm: best.distanceKm, elevationM: best.elevationM }
}

export function fmtNumber(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1).replace('.', ',')
}

// Format untuk VALUE input — tampilkan apa adanya TANPA toFixed.
// fmtNumber membulatkan 1 desimal sehingga round-trip display merusak data
// (2.29 → "2,3" → parse → 2.3). fmtInput dipakai di value= input saja;
// label/badge tampilan tetap pakai fmtNumber yang ringkas.
export function fmtInput(n: number): string {
  return String(n).replace('.', ',')
}

/**
 * Cari exercise IDs yang ada di sessions tapi tidak ada di library (terhapus).
 * Return Map<exerciseId, { totalSets, totalVolume, lastDate, sessionCount }>.
 */
export function findOrphanedExercises(
  sessions: Session[],
  exercises: Exercise[],
): Map<string, { totalSets: number; totalVolume: number; lastDate: string; sessionCount: number; exerciseIds: string[] }> {
  const knownIds = new Set(exercises.map((e) => e.id))
  const map = new Map<string, { totalSets: number; totalVolume: number; lastDate: string; sessionCount: number; exerciseIds: string[] }>()

  for (const s of sessions) {
    const seen = new Set<string>()
    for (const set of s.sets) {
      if (knownIds.has(set.exerciseId)) continue
      const existing = map.get(set.exerciseId)
      const vol = volumeOf([set])
      if (existing) {
        existing.totalSets++
        existing.totalVolume += vol
        if (s.date > existing.lastDate) existing.lastDate = s.date
        if (!seen.has(set.exerciseId)) { existing.sessionCount++; seen.add(set.exerciseId) }
      } else {
        map.set(set.exerciseId, {
          totalSets: 1,
          totalVolume: vol,
          lastDate: s.date,
          sessionCount: seen.has(set.exerciseId) ? 0 : 1,
          exerciseIds: [set.exerciseId],
        })
        seen.add(set.exerciseId)
      }
    }
  }
  return map
}
// Nomor set dirapikan per gerakan: setelah hapus set, set yang tersisa
// dinomori ulang 1..n sesuai urutan — daftar jangan mulai dari 2.
// Dipakai juga saat urungkan hapus: set yang dikembalikan ikut dihitung
// ulang dari posisinya, jadi tidak ada nomor ganda. Gerakan lain tidak
// ikut berubah; beban/rep tiap set tetap sama.
export function renumberExerciseSets(sets: SessionSet[], exerciseId: string): SessionSet[] {
  const group = sets
    .filter((s) => s.exerciseId === exerciseId)
    .slice()
    .sort((a, b) => a.setNumber - b.setNumber)
  const nextNo = new Map(group.map((s, i) => [s.id, i + 1] as const))
  return sets.map((s) =>
    s.exerciseId === exerciseId && nextNo.has(s.id) ? { ...s, setNumber: nextNo.get(s.id)! } : s,
  )
}

// Pindah urutan satu gerakan dalam sesi (naik/turun satu posisi) —
// mis. Bench Press yang kelupaan dan baru ditambah belakangan bisa
// dipindah ke atas. Urutan gerakan = urutan kemunculan pertama set-nya
// di array; set dalam satu gerakan tetap berurutan menurut nomor set-nya.
// Di ujung (paling atas/bawah) atau gerakan tidak dikenal: tidak berubah
// (referensi array yang sama dikembalikan).
export function moveExerciseSets(sets: SessionSet[], exerciseId: string, dir: -1 | 1): SessionSet[] {
  const order: string[] = []
  for (const s of sets) if (!order.includes(s.exerciseId)) order.push(s.exerciseId)
  const i = order.indexOf(exerciseId)
  const j = i + dir
  if (i < 0 || j < 0 || j >= order.length) return sets
  ;[order[i], order[j]] = [order[j], order[i]]
  const byEx = new Map<string, SessionSet[]>()
  for (const s of sets) {
    const arr = byEx.get(s.exerciseId) ?? []
    arr.push(s)
    byEx.set(s.exerciseId, arr)
  }
  return order.flatMap((ex) => (byEx.get(ex) ?? []).slice().sort((a, b) => a.setNumber - b.setNumber))
}

// Balik flag boolean untuk satu id dalam record; kembalikan record baru.
// Dipakai untuk hide/unhide kotak "Tambah set cepat" per gerakan.
export function toggleFlag(map: Record<string, boolean>, id: string): Record<string, boolean> {
  return { ...map, [id]: !map[id] }
}
