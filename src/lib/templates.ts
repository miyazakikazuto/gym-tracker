export interface PresetExercise {
  name: string
  muscleGroup: string
  equipment: string
}

export interface PlanPreset {
  key: string
  name: string
  shortLabel: string
  exercises: PresetExercise[]
}

export const PLAN_PRESETS: PlanPreset[] = [
  {
    key: 'push',
    name: 'Push Day',
    shortLabel: 'PUSH',
    exercises: [
      { name: 'Bench Press', muscleGroup: 'Dada', equipment: 'Barbell' },
      { name: 'Incline Dumbbell Press', muscleGroup: 'Dada', equipment: 'Dumbbell' },
      { name: 'Overhead Press', muscleGroup: 'Bahu', equipment: 'Barbell' },
      { name: 'Lateral Raise', muscleGroup: 'Bahu', equipment: 'Dumbbell' },
      { name: 'Triceps Pushdown', muscleGroup: 'Trisep', equipment: 'Kabel' },
      { name: 'Dips', muscleGroup: 'Trisep', equipment: 'Bodyweight' },
    ],
  },
  {
    key: 'pull',
    name: 'Pull Day',
    shortLabel: 'PULL',
    exercises: [
      { name: 'Lat Pulldown', muscleGroup: 'Punggung', equipment: 'Kabel' },
      { name: 'Barbell Row', muscleGroup: 'Punggung', equipment: 'Barbell' },
      { name: 'Seated Cable Row', muscleGroup: 'Punggung', equipment: 'Kabel' },
      { name: 'Bicep Curl', muscleGroup: 'Bisep', equipment: 'Dumbbell' },
      { name: 'Hammer Curl', muscleGroup: 'Bisep', equipment: 'Dumbbell' },
      { name: 'Face Pull', muscleGroup: 'Bahu', equipment: 'Kabel' },
    ],
  },
  {
    key: 'leg',
    name: 'Leg Day',
    shortLabel: 'LEG',
    exercises: [
      { name: 'Squat', muscleGroup: 'Kaki', equipment: 'Barbell' },
      { name: 'Leg Press', muscleGroup: 'Kaki', equipment: 'Machine' },
      { name: 'Romanian Deadlift', muscleGroup: 'Kaki', equipment: 'Barbell' },
      { name: 'Leg Extension', muscleGroup: 'Kaki', equipment: 'Machine' },
      { name: 'Leg Curl', muscleGroup: 'Kaki', equipment: 'Machine' },
      { name: 'Calf Raise', muscleGroup: 'Kaki', equipment: 'Machine' },
    ],
  },
  {
    key: 'cardio',
    name: 'Cardio Day',
    shortLabel: 'CARDIO',
    exercises: [
      { name: 'Treadmill', muscleGroup: 'Cardio', equipment: 'Machine' },
      { name: 'Stationary Bike', muscleGroup: 'Cardio', equipment: 'Machine' },
      { name: 'Row Machine', muscleGroup: 'Cardio', equipment: 'Machine' },
      { name: 'Jump Rope', muscleGroup: 'Cardio', equipment: 'Bodyweight' },
    ],
  },
  {
    key: 'home',
    name: 'Home Gym',
    shortLabel: 'HOME',
    exercises: [
      { name: 'Pull-Up', muscleGroup: 'Punggung', equipment: 'Bodyweight' },
      { name: 'Chin-Up', muscleGroup: 'Punggung', equipment: 'Bodyweight' },
      { name: 'Dumbbell Row', muscleGroup: 'Punggung', equipment: 'Dumbbell' },
      { name: 'Push-Up', muscleGroup: 'Dada', equipment: 'Bodyweight' },
      { name: 'Dumbbell Floor Press', muscleGroup: 'Dada', equipment: 'Dumbbell' },
      { name: 'Dumbbell Shoulder Press', muscleGroup: 'Bahu', equipment: 'Dumbbell' },
      { name: 'Dumbbell Lateral Raise', muscleGroup: 'Bahu', equipment: 'Dumbbell' },
      { name: 'Dumbbell Bicep Curl', muscleGroup: 'Bisep', equipment: 'Dumbbell' },
      { name: 'Goblet Squat', muscleGroup: 'Kaki', equipment: 'Dumbbell' },
      { name: 'Dumbbell Romanian Deadlift', muscleGroup: 'Kaki', equipment: 'Dumbbell' },
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
