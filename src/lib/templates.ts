export interface PresetExercise {
  name: string
  muscleGroup: string
  equipment: string
}

export interface PlanPreset {
  key: string
  name: string
  shortLabel: string
  dotColor?: string
  exercises: PresetExercise[]
}

export const PLAN_PRESETS: PlanPreset[] = [
  {
    key: 'leg',
    name: 'Leg Day',
    shortLabel: 'LEG',
    dotColor: '#44cc88',
    exercises: [
      // Nama disamakan dengan DEFAULT_EXERCISES (src/lib/defaults.ts) supaya
      // templatePlan() menemukan gerakan yang sudah ada di library —
      // bukan membuat duplikat baru saat "Pilih plan lain".
      { name: 'Barbell Squat', muscleGroup: 'Kaki', equipment: 'Barbell' },
      { name: 'Leg Press', muscleGroup: 'Kaki', equipment: 'Machine' },
      { name: 'Romanian Deadlift', muscleGroup: 'Kaki', equipment: 'Barbell' },
      { name: 'Leg Extension', muscleGroup: 'Kaki', equipment: 'Machine' },
      { name: 'Leg Curl', muscleGroup: 'Kaki', equipment: 'Machine' },
      { name: 'Calf Raise', muscleGroup: 'Kaki', equipment: 'Machine' },
    ],
  },
  {
    key: 'push',
    name: 'Push Day',
    shortLabel: 'PUSH',
    dotColor: '#6699ff',
    exercises: [
      { name: 'Bench Press', muscleGroup: 'Dada', equipment: 'Barbell' },
      { name: 'Incline DB press', muscleGroup: 'Dada', equipment: 'Dumbbell' },
      { name: 'Overhead Press', muscleGroup: 'Bahu', equipment: 'Barbell' },
      { name: 'DB Lateral Raise', muscleGroup: 'Bahu', equipment: 'Dumbbell' },
      { name: 'Tricep Pushdown', muscleGroup: 'Trisep', equipment: 'Kabel' },
      { name: 'Pec Fly (Machine)', muscleGroup: 'Dada', equipment: 'Machine' },
    ],
  },
  {
    key: 'pull',
    name: 'Pull Day',
    shortLabel: 'PULL',
    dotColor: '#aa77ff',
    exercises: [
      { name: 'Lat Pulldown', muscleGroup: 'Punggung', equipment: 'Kabel' },
      { name: 'Barbell Row', muscleGroup: 'Punggung', equipment: 'Barbell' },
      { name: 'Seated Cable Row', muscleGroup: 'Punggung', equipment: 'Kabel' },
      { name: 'Bicep Curl DB', muscleGroup: 'Bisep', equipment: 'Dumbbell' },
      { name: 'Hammer Curl', muscleGroup: 'Bisep', equipment: 'Dumbbell' },
      { name: 'Face Pull', muscleGroup: 'Bahu', equipment: 'Kabel' },
    ],
  },
  {
    key: 'easy',
    name: 'Easy Day',
    shortLabel: 'EASY',
    dotColor: '#7ee787',
    exercises: [
      { name: 'Cable Hip Abduction', muscleGroup: 'Kaki', equipment: 'Kabel' },
      { name: 'Push-Up', muscleGroup: 'Dada', equipment: 'Bodyweight' },
      { name: 'Chin-Up', muscleGroup: 'Punggung', equipment: 'Bodyweight' },
      { name: 'DB Lateral Raise', muscleGroup: 'Bahu', equipment: 'Dumbbell' },
      { name: 'Dead Hang', muscleGroup: 'Forearm', equipment: 'Bodyweight' },
      { name: 'Calf Raise', muscleGroup: 'Kaki', equipment: 'Machine' },
    ],
  },
  {
    key: 'cardio',
    name: 'Cardio Day',
    shortLabel: 'CARDIO',
    dotColor: '#ff6699',
    exercises: [
      { name: 'Treadmill', muscleGroup: 'Cardio', equipment: 'Bodyweight' },
      { name: 'Stationary Bike', muscleGroup: 'Cardio', equipment: 'Bodyweight' },
      { name: 'Easy Running', muscleGroup: 'Cardio', equipment: 'Bodyweight' },
    ],
  },
  {
    key: 'rest',
    name: 'Rest Day',
    shortLabel: 'REST',
    exercises: [],
  },
]

export function presetByKey(key: string): PlanPreset | undefined {
  return PLAN_PRESETS.find((p) => p.key === key)
}

export function presetByName(name: string): PlanPreset | undefined {
  return PLAN_PRESETS.find((p) => p.name === name)
}

export function isRest(name: string): boolean {
  return presetByName(name)?.key === 'rest'
}

export function shortLabelFor(name: string): string {
  return presetByName(name)?.shortLabel ?? ''
}

export function dotColorFor(name: string): string | undefined {
  return presetByName(name)?.dotColor
}
