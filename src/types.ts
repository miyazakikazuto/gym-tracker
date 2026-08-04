export interface Exercise {
  id: string
  name: string
  muscleGroup: string
  equipment: string
  category?: string // push | pull | leg | cardio | home
}

export const EXERCISE_CATEGORIES = [
  { key: 'push', name: 'Push', shortLabel: 'PUSH' },
  { key: 'pull', name: 'Pull', shortLabel: 'PULL' },
  { key: 'leg', name: 'Leg', shortLabel: 'LEG' },
  { key: 'cardio', name: 'Cardio', shortLabel: 'CARDIO' },
  { key: 'home', name: 'Home Gym', shortLabel: 'HOME' },
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
}

export const MUSCLE_GROUPS = [
  'Dada',
  'Punggung',
  'Kaki',
  'Bahu',
  'Bisep',
  'Trisep',
  'Core',
  'Cardio',
  'Lainnya',
] as const

export const EQUIPMENTS = [
  'Barbell',
  'Dumbbell',
  'Machine',
  'Kabel',
  'Bodyweight',
  'Band',
  'Lainnya',
] as const

export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const