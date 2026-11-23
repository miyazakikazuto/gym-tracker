export interface Exercise {
  id: string
  name: string
  muscleGroup: string
  equipment: string
  category?: string // push | pull | leg | cardio | home
  extraCategories?: string[] // hari tambahan selain kategori utama
  type?: 'reps' | 'duration' // tidak ada = reps
}

export const EXERCISE_TYPES = [
  { key: 'reps', name: 'Reps (set × rep)' },
  { key: 'duration', name: 'Durasi (jam·menit)' },
] as const

export const EXERCISE_CATEGORIES = [
  { key: 'leg', name: 'Lower', shortLabel: 'LOW' },
  { key: 'push', name: 'Arm & Shoulder', shortLabel: 'ARM' },
  { key: 'pull', name: 'Upper', shortLabel: 'UPP' },
  { key: 'easy', name: 'Full Body', shortLabel: 'FULL' },
  { key: 'cardio', name: 'Cardio', shortLabel: 'CARDIO' },
] as const

export interface PlanItem {
  exerciseId: string
  order: number
  targetSets: number
  /**
   * Jumlah repetisi bila exercise.type !== 'duration'.
   * Bila exercise bertipe 'duration', field ini menyimpan durationSec (detik),
   * bukan rep — dipakai `gymstore.buildSession(typeOf)` untuk branch
   * `typeOf(exId)==='duration' ? durationSec : reps`. Overloading disengaja
   * agar dokumen Firestore lama tetap kompatibel; jangan rename.
   * Lihat juga `helpers.exerciseIsDuration()` untuk pengecekan tipe.
   */
  reps: number
  restSec: number
}

export interface WorkoutPlan {
  id: string
  name: string
  dayOfWeek: number // 0 = Minggu ... 6 = Sabtu
  items: PlanItem[]
}

export interface SessionSet {
  id: string
  exerciseId: string
  setNumber: number
  weightKg: number
  reps: number
  durationSec?: number // set gerakan durasi (tidak ada = reps)
  distanceKm?: number // jarak per set (cardio)
  elevationM?: number // elevasi/ketinggian naik dalam meter (cardio outdoor)
}

// Intensitas mode autoregulasi — dipilih per sesi sesuai kondisi fisik
// (bukan skema 5/3/1). Lihat src/lib/autoreg.ts untuk faktor bebannya.
export type AutoIntensity = 'light' | 'medium' | 'heavy'

export interface Session {
  id: string
  date: string // YYYY-MM-DD (WIB)
  planId: string | null
  planName: string
  note: string
  startedAt: number // epoch ms
  endedAt: number | null
  sets: SessionSet[]
  intensity?: AutoIntensity // mode autoregulasi: Ringan/Sedang/Berat saat sesi dibuat
  rpe?: number // RPE sesi 1..10 (di footer, bukan per gerakan)
  rpes?: Record<string, number> // LEGACY per-gerakan 6..10 — dibaca sebagai fallback avg→rpe
  // Snapshot 5/3/1 saat sesi dibuat — stiker cycle biar history/rekap tetap kebal perubahan setting
  cycle?: number // C1, C2, ...
  sessionIndex?: number // 0-based dalam cycle
  cycleLabel?: string // "[C1-S03] Leg Day — 3×5"
  scheme?: string // "3×5" / "3×3" / "5/3/1" / "Deload"
  isExtra?: boolean // true = sesi tambahan, tidak majuin siklus 5/3/1 & rotasi
}

export interface Bodyweight {
  id: string // 'YYYY-MM-DD'
  date: string
  kg: number
}

// Pengaturan user — disimpan di users/{uid}/settings/prefs
export interface UserSettings {
  rotationMode?: boolean // LEGACY (mode Mingguan dihapus): true/absen = rotasi, field tidak dibaca lagi
  rotation: string[] // urutan rotasi — key preset (default: leg → easy → push → pull)
  shiftAnchor: string // tanggal patokan siklus shift — hari ke-1 blok Sore (default '2026-08-12')
  weightTarget: number | null // target berat badan (kg) — null = tanpa target
  weightTargetBase: number | null // berat awal saat target diset (baseline kemajuan)
  shiftOverride: Record<string, string> // tanggal 'YYYY-MM-DD' → 'pagi'|'siang'|'malam'|'libur'|'cuti' (timpa manual per hari)

  // 5/3/1 Wendler periodization
  cycleNumber: number // cycle saat ini (1-based)
  sessionIndex: number // posisi dalam cycle (0-15)
  trainingMax: {
    squat: number
    bench: number
    deadlift: number
  }
  excludeEasyDay?: boolean // true = Easy Day dihapus dari siklus 5/3/1 (cycle jadi 12 sesi)
  skippedSessions?: number // jumlah sesi yang di-skip (posisi tetap maju)
  rehabMode?: boolean // true = Mode Rehab: 5/3/1 & TM dimatikan, saran ikut REHAB_CYCLE (lib/rehab.ts)
  autoRegMode?: boolean // true = Mode Autoregulasi: 5/3/1 & TM dimatikan, tiap sesi pilih intensitas (Ringan/Sedang/Berat) sesuai kondisi fisik (lib/autoreg.ts)
  freeOrder?: boolean // true = Week-3 Pull/Push/Leg bebas urut, 3/3 baru lanjut, duplicate=1
  freeOrderSince?: string // YYYY-MM-DD jangkar mulai Week-3 (biar Week tidak loncat ke 13)
  freeOrderOffset?: number // counted snapshot saat ON (untuk hitung Week dari 1)
}

export const MUSCLE_GROUPS = [
  'Dada',
  'Punggung',
  'Kaki',
  'Bahu',
  'Bisep',
  'Trisep',
  'Forearm',
  'Core',
  'Cardio',
] as const

export const EQUIPMENTS = [
  'Barbell',
  'Dumbbell',
  'Machine',
  'Kabel',
  'Bodyweight',
] as const

export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const