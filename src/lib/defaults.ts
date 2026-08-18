// Default exercises untuk akun baru — diambil dari data user (46 gerakan),
// difilter: hanya yang TIDAK punya extraCategories (tidak tampil di hari lain).
// Saat user baru pertama kali login,ercises ini otomatis dibuat ke Firestore.

export interface DefaultExercise {
  name: string
  muscleGroup: string
  equipment: string
  category: string
  type?: 'reps' | 'duration'
}

export const DEFAULT_EXERCISES: DefaultExercise[] = [
  // ===== LEG =====
  { name: 'Leg Extension', muscleGroup: 'Kaki', equipment: 'Machine', category: 'leg' },
  { name: 'Bulgarian Split Squat', muscleGroup: 'Kaki', equipment: 'Dumbbell', category: 'leg' },
  { name: 'Hack Squat', muscleGroup: 'Kaki', equipment: 'Machine', category: 'leg' },
  { name: 'Leg Curl Unilateral', muscleGroup: 'Kaki', equipment: 'Machine', category: 'leg' },
  { name: 'Abductor', muscleGroup: 'Kaki', equipment: 'Machine', category: 'leg' },
  { name: 'Adductor', muscleGroup: 'Kaki', equipment: 'Machine', category: 'leg' },
  { name: 'Leg Press', muscleGroup: 'Kaki', equipment: 'Machine', category: 'leg' },
  { name: 'Romanian Deadlift', muscleGroup: 'Kaki', equipment: 'Barbell', category: 'leg' },
  { name: 'Leg Curl', muscleGroup: 'Kaki', equipment: 'Machine', category: 'leg' },
  { name: 'Leg Extension Unilateral', muscleGroup: 'Kaki', equipment: 'Machine', category: 'leg' },
  { name: 'Hip Thrust', muscleGroup: 'Kaki', equipment: 'Barbell', category: 'leg' },

  // ===== PUSH =====
  { name: 'Lateral Raise Cable', muscleGroup: 'Bahu', equipment: 'Kabel', category: 'push' },
  { name: 'Incline DB press', muscleGroup: 'Dada', equipment: 'Dumbbell', category: 'push' },
  { name: 'Rear Delt Fly', muscleGroup: 'Bahu', equipment: 'Machine', category: 'push' },
  { name: 'Front Raise', muscleGroup: 'Bahu', equipment: 'Dumbbell', category: 'push' },
  { name: 'Pec Fly (Machine)', muscleGroup: 'Dada', equipment: 'Machine', category: 'push' },
  { name: 'Overhead Press', muscleGroup: 'Bahu', equipment: 'Barbell', category: 'push' },
  { name: 'Incline Bench Press', muscleGroup: 'Dada', equipment: 'Barbell', category: 'push' },
  { name: 'Bench Press', muscleGroup: 'Dada', equipment: 'Barbell', category: 'push' },

  // ===== PULL =====
  { name: 'Single DB row', muscleGroup: 'Punggung', equipment: 'Dumbbell', category: 'pull' },
  { name: 'Hammer Curl', muscleGroup: 'Bisep', equipment: 'Dumbbell', category: 'pull' },
  { name: 'Barbell Row', muscleGroup: 'Punggung', equipment: 'Barbell', category: 'pull' },
  { name: 'Face Pull', muscleGroup: 'Bahu', equipment: 'Kabel', category: 'pull' },
  { name: 'Single arm Lat pulldown', muscleGroup: 'Punggung', equipment: 'Kabel', category: 'pull' },
  { name: 'Seated Cable Row', muscleGroup: 'Punggung', equipment: 'Kabel', category: 'pull' },
  { name: 'Pull-Up', muscleGroup: 'Punggung', equipment: 'Bodyweight', category: 'pull' },
  { name: 'Lat Pulldown', muscleGroup: 'Punggung', equipment: 'Kabel', category: 'pull' },

  // ===== EASY / HOME =====
  { name: 'Push-Up', muscleGroup: 'Dada', equipment: 'Bodyweight', category: 'home' },

  // ===== CARDIO =====
  { name: 'Treadmill', muscleGroup: 'Cardio', equipment: 'Bodyweight', category: 'cardio', type: 'duration' },
  { name: 'Stationary Bike', muscleGroup: 'Cardio', equipment: 'Bodyweight', category: 'cardio' },
  { name: 'Easy Running', muscleGroup: 'Cardio', equipment: 'Bodyweight', category: 'cardio', type: 'duration' },
]
