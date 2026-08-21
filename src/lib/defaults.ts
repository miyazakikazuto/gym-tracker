// Default exercises untuk akun baru — diambil dari data user (49 gerakan).
// Saat user baru pertama kali login, exercises ini otomatis dibuat ke Firestore.

export interface DefaultExercise {
  name: string
  muscleGroup: string
  equipment: string
  category: string
  extraCategories?: string[]
  type?: 'reps' | 'duration'
}

export const DEFAULT_EXERCISES: DefaultExercise[] = [
  // ===== LEG =====
  { name: 'Leg Extension', muscleGroup: 'Kaki', equipment: 'Machine', category: 'leg' },
  { name: 'Bulgarian Split Squat', muscleGroup: 'Kaki', equipment: 'Dumbbell', category: 'leg' },
  { name: 'Hack Squat', muscleGroup: 'Kaki', equipment: 'Machine', category: 'leg' },
  { name: 'Reverse Hack Squat', muscleGroup: 'Kaki', equipment: 'Machine', category: 'leg' },
  { name: 'Leg Curl Unilateral', muscleGroup: 'Kaki', equipment: 'Machine', category: 'leg' },
  { name: 'Abductor', muscleGroup: 'Kaki', equipment: 'Machine', category: 'leg' },
  { name: 'Adductor', muscleGroup: 'Kaki', equipment: 'Machine', category: 'leg' },
  { name: 'Leg Press', muscleGroup: 'Kaki', equipment: 'Machine', category: 'leg' },
  { name: 'Romanian Deadlift', muscleGroup: 'Kaki', equipment: 'Barbell', category: 'leg' },
  { name: 'Leg Curl', muscleGroup: 'Kaki', equipment: 'Machine', category: 'leg' },
  { name: 'Leg Extension Unilateral', muscleGroup: 'Kaki', equipment: 'Machine', category: 'leg' },
  { name: 'Hip Thrust', muscleGroup: 'Kaki', equipment: 'Barbell', category: 'leg' },
  { name: 'Calf Raise', muscleGroup: 'Kaki', equipment: 'Machine', category: 'leg', extraCategories: ['easy', 'push'] },
  { name: 'Barbell Squat', muscleGroup: 'Kaki', equipment: 'Barbell', category: 'leg', extraCategories: ['pull'] },
  { name: 'Sumo deadlift', muscleGroup: 'Kaki', equipment: 'Barbell', category: 'leg', extraCategories: ['pull'] },
  { name: 'Cable Hip Abduction', muscleGroup: 'Kaki', equipment: 'Kabel', category: 'leg', extraCategories: ['push', 'easy'] },

  // ===== PUSH =====
  { name: 'Lateral Raise Cable', muscleGroup: 'Bahu', equipment: 'Kabel', category: 'push' },
  { name: 'Incline DB press', muscleGroup: 'Dada', equipment: 'Dumbbell', category: 'push' },
  { name: 'Rear Delt Fly', muscleGroup: 'Bahu', equipment: 'Machine', category: 'push' },
  { name: 'Front Raise', muscleGroup: 'Bahu', equipment: 'Dumbbell', category: 'push' },
  { name: 'Pec Fly (Machine)', muscleGroup: 'Dada', equipment: 'Machine', category: 'push' },
  { name: 'Overhead Press', muscleGroup: 'Bahu', equipment: 'Barbell', category: 'push' },
  { name: 'Incline Bench Press', muscleGroup: 'Dada', equipment: 'Barbell', category: 'push' },
  { name: 'Bench Press', muscleGroup: 'Dada', equipment: 'Barbell', category: 'push' },
  { name: 'DB Bench Press', muscleGroup: 'Dada', equipment: 'Dumbbell', category: 'push', extraCategories: ['easy'] },
  { name: 'DB Lateral Raise', muscleGroup: 'Bahu', equipment: 'Dumbbell', category: 'push', extraCategories: ['easy'] },
  { name: 'Tricep Pushdown', muscleGroup: 'Trisep', equipment: 'Kabel', category: 'push', extraCategories: ['easy'] },

  // ===== PULL =====
  { name: 'Single DB row', muscleGroup: 'Punggung', equipment: 'Dumbbell', category: 'pull' },
  { name: 'Hammer Curl', muscleGroup: 'Bisep', equipment: 'Dumbbell', category: 'pull' },
  { name: 'Barbell Row', muscleGroup: 'Punggung', equipment: 'Barbell', category: 'pull' },
  { name: 'Face Pull', muscleGroup: 'Bahu', equipment: 'Kabel', category: 'pull' },
  { name: 'Single arm Lat pulldown', muscleGroup: 'Punggung', equipment: 'Kabel', category: 'pull' },
  { name: 'Seated Cable Row', muscleGroup: 'Punggung', equipment: 'Kabel', category: 'pull' },
  { name: 'Pull-Up', muscleGroup: 'Punggung', equipment: 'Bodyweight', category: 'pull' },
  { name: 'Lat Pulldown', muscleGroup: 'Punggung', equipment: 'Kabel', category: 'pull' },
  { name: 'DB Shrugs', muscleGroup: 'Punggung', equipment: 'Dumbbell', category: 'pull', extraCategories: ['push'] },
  { name: 'Cable Shrugs', muscleGroup: 'Punggung', equipment: 'Kabel', category: 'pull', extraCategories: ['push'] },
  { name: 'Conventional Deadlift', muscleGroup: 'Punggung', equipment: 'Barbell', category: 'pull', extraCategories: ['leg'] },
  { name: 'Bicep Curl DB', muscleGroup: 'Bisep', equipment: 'Dumbbell', category: 'pull', extraCategories: ['easy'] },
  { name: 'Bicep Curl Cable', muscleGroup: 'Bisep', equipment: 'Machine', category: 'pull', extraCategories: ['push', 'easy'] },
  { name: 'wrist curl', muscleGroup: 'Forearm', equipment: 'Dumbbell', category: 'pull', extraCategories: ['easy'] },
  { name: 'reverse wrist curl', muscleGroup: 'Forearm', equipment: 'Dumbbell', category: 'pull', extraCategories: ['easy'] },
  { name: 'Dead Hang', muscleGroup: 'Forearm', equipment: 'Bodyweight', category: 'pull', extraCategories: ['easy'], type: 'duration' },
  { name: 'Farmer hold', muscleGroup: 'Forearm', equipment: 'Dumbbell', category: 'pull', extraCategories: ['easy'], type: 'duration' },

  // ===== EASY / HOME =====
  { name: 'Push-Up', muscleGroup: 'Dada', equipment: 'Bodyweight', category: 'home' },
  { name: 'Chin-Up', muscleGroup: 'Punggung', equipment: 'Bodyweight', category: 'easy', extraCategories: ['pull'] },

  // ===== CARDIO =====
  { name: 'Treadmill', muscleGroup: 'Cardio', equipment: 'Bodyweight', category: 'cardio', type: 'duration' },
  { name: 'Stationary Bike', muscleGroup: 'Cardio', equipment: 'Bodyweight', category: 'cardio' },
  { name: 'Easy Running', muscleGroup: 'Cardio', equipment: 'Bodyweight', category: 'cardio', type: 'duration' },
]
