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
  { key: 'duration', name: 'Durasi (dtk)' },
] as const

export const EXERCISE_CATEGORIES = [
  { key: 'leg', name: 'Leg', shortLabel: 'LEG' },
  { key: 'push', name: 'Push', shortLabel: 'PUSH' },
  { key: 'pull', name: 'Pull', shortLabel: 'PULL' },
  { key: 'easy', name: 'Easy Day', shortLabel: 'EASY' },
  { key: 'cardio', name: 'Cardio', shortLabel: 'CARDIO' },
] as const

export interface PlanItem {
  exerciseId: string
  order: number
  targetSets: number
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

export interface Session {
  id: string
  date: string // YYYY-MM-DD (WIB)
  planId: string | null
  planName: string
  note: string
  startedAt: number // epoch ms
  endedAt: number | null
  sets: SessionSet[]
  rpes?: Record<string, number> // exerciseId → RPE 6..10
}

export interface Bodyweight {
  id: string // 'YYYY-MM-DD'
  date: string
  kg: number
}

// Pengaturan user — disimpan di users/{uid}/settings/prefs
export interface UserSettings {
  rotationMode: boolean // true = saran rotasi (default), false = jadwal mingguan
  rotation: string[] // urutan rotasi — key preset (default: leg → easy → push → pull)
  shiftAnchor: string // tanggal patokan siklus shift — hari ke-1 blok Sore (default '2026-08-12')
  weightTarget: number | null // target berat badan (kg) — null = tanpa target
  weightTargetBase: number | null // berat awal saat target diset (baseline kemajuan)
  shiftOverride: Record<string, string> // tanggal 'YYYY-MM-DD' → 'pagi'|'siang'|'malam'|'libur' (timpa manual per hari)

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