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
    name: 'Lower',
    shortLabel: 'LOW',
    dotColor: '#44cc88',
    exercises: [
      // Nama disamakan dengan DEFAULT_EXERCISES (src/lib/defaults.ts) supaya
      // templatePlan() menemukan gerakan yang sudah ada di library —
      // bukan membuat duplikat baru saat "Pilih plan lain".
      // Urutan user: Press → Thrust → Calf → Squat → Abductor → Adductor.
      // Hip Thrust = pengganti Leg Curl.
      { name: 'Leg Press', muscleGroup: 'Kaki', equipment: 'Machine' },
      { name: 'Hip Thrust', muscleGroup: 'Kaki', equipment: 'Barbell' },
      { name: 'Calf Raise', muscleGroup: 'Kaki', equipment: 'Machine' },
      { name: 'Barbell Squat', muscleGroup: 'Kaki', equipment: 'Barbell' },
      { name: 'Abductor', muscleGroup: 'Kaki', equipment: 'Machine' },
      { name: 'Adductor', muscleGroup: 'Kaki', equipment: 'Machine' },
    ],
  },
  {
    key: 'push',
    name: 'Arm & Shoulder',
    shortLabel: 'ARM',
    dotColor: '#6699ff',
    exercises: [
      { name: 'Overhead Press', muscleGroup: 'Bahu', equipment: 'Barbell' },
      { name: 'DB Lateral Raise', muscleGroup: 'Bahu', equipment: 'Dumbbell' },
      { name: 'Bicep Curl DB', muscleGroup: 'Bisep', equipment: 'Dumbbell' },
      { name: 'Hammer Curl', muscleGroup: 'Bisep', equipment: 'Dumbbell' },
      { name: 'Tricep Pushdown', muscleGroup: 'Trisep', equipment: 'Kabel' },
      { name: 'Pec Fly (Machine)', muscleGroup: 'Dada', equipment: 'Machine' },
    ],
  },
  {
    key: 'pull',
    name: 'Upper',
    shortLabel: 'UPP',
    dotColor: '#aa77ff',
    exercises: [
      // Dada + punggung bersamaan, ringan — Bench & Row tetap, tapi tanpa skema berat.
      { name: 'Bench Press', muscleGroup: 'Dada', equipment: 'Barbell' },
      { name: 'Incline DB press', muscleGroup: 'Dada', equipment: 'Dumbbell' },
      { name: 'Lat Pulldown', muscleGroup: 'Punggung', equipment: 'Kabel' },
      { name: 'Barbell Row', muscleGroup: 'Punggung', equipment: 'Barbell' },
      { name: 'Seated Cable Row', muscleGroup: 'Punggung', equipment: 'Kabel' },
      { name: 'Face Pull', muscleGroup: 'Bahu', equipment: 'Kabel' },
    ],
  },
  {
    key: 'easy',
    name: 'Full Body',
    shortLabel: 'FULL',
    dotColor: '#7ee787',
    exercises: [
      { name: 'Barbell Squat', muscleGroup: 'Kaki', equipment: 'Barbell' },
      { name: 'Bench Press', muscleGroup: 'Dada', equipment: 'Barbell' },
      { name: 'Lat Pulldown', muscleGroup: 'Punggung', equipment: 'Kabel' },
      { name: 'Overhead Press', muscleGroup: 'Bahu', equipment: 'Barbell' },
      { name: 'Hip Thrust', muscleGroup: 'Kaki', equipment: 'Barbell' },
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
      { name: 'Jalan Kaki', muscleGroup: 'Cardio', equipment: 'Bodyweight' },
    ],
  },
  {
    key: 'rest',
    name: 'Rest Day',
    shortLabel: 'REST',
    exercises: [],
  },
  // ===== REHAB (Mode Rehab: tangan kiri rest, lutut kanan isometrik) =====
  // Nama preset disamakan dengan DEFAULT_EXERCISES (src/lib/defaults.ts)
  // supaya templatePlan() menemukan gerakan yang sudah ada di library.
  {
    key: 'leg-iso',
    name: 'Leg Rehab Iso',
    shortLabel: 'ISO',
    dotColor: '#7ee787',
    exercises: [
      { name: 'Isometrik Quad 60°', muscleGroup: 'Kaki', equipment: 'Machine' },
      { name: 'Leg Extension Unilateral', muscleGroup: 'Kaki', equipment: 'Machine' },
      { name: 'Adductor', muscleGroup: 'Kaki', equipment: 'Machine' },
      { name: 'Abductor', muscleGroup: 'Kaki', equipment: 'Machine' },
    ],
  },
  {
    key: 'leg-light',
    name: 'Leg Ringan',
    shortLabel: 'LRING',
    dotColor: '#44cc88',
    exercises: [
      // Leg Curl TETAP ada (keputusan user) — ringan 2x6-8, stop bila panas >5/10
      { name: 'Leg Extension Unilateral', muscleGroup: 'Kaki', equipment: 'Machine' },
      { name: 'Leg Curl Unilateral', muscleGroup: 'Kaki', equipment: 'Machine' },
      { name: 'Adductor', muscleGroup: 'Kaki', equipment: 'Machine' },
      { name: 'Abductor', muscleGroup: 'Kaki', equipment: 'Machine' },
      { name: 'Calf Raise', muscleGroup: 'Kaki', equipment: 'Machine' },
    ],
  },
  {
    key: 'upper-r',
    name: 'Upper Kanan',
    shortLabel: 'UKAN',
    dotColor: '#6699ff',
    exercises: [
      { name: 'Single-Arm DB Press Kanan', muscleGroup: 'Dada', equipment: 'Dumbbell' },
      { name: 'Single-Arm Cable Row Kanan', muscleGroup: 'Punggung', equipment: 'Kabel' },
      { name: 'Single-Arm Lateral Raise Kanan', muscleGroup: 'Bahu', equipment: 'Dumbbell' },
      { name: 'Single-Arm Curl Kanan', muscleGroup: 'Bisep', equipment: 'Dumbbell' },
    ],
  },
]

export function presetByKey(key: string): PlanPreset | undefined {
  return PLAN_PRESETS.find((p) => p.key === key)
}

// Kategori library untuk gerakan preset — key preset rehab (leg-iso/upper-r)
// BUKAN kategori valid (tab Library: leg/push/pull/easy/cardio), jadi petakan
// ke kategori dasar. Tanpa ini gerakan auto-create tidak muncul di tab mana pun.
const MUSCLE_TO_BASE: Record<string, string> = {
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

export function baseCategoryForPresetKey(key: string, muscleGroup: string): string {
  if (['leg', 'push', 'pull', 'easy', 'cardio'].includes(key)) return key
  return MUSCLE_TO_BASE[muscleGroup] ?? 'leg'
}

// Isometrik/hold/plank + seluruh cardio dicatat durasi, sisanya reps.
export function typeForPresetExercise(name: string, muscleGroup: string): 'reps' | 'duration' {
  if (muscleGroup === 'Cardio') return 'duration'
  return /iso|isometr|hold|plank|hang/i.test(name) ? 'duration' : 'reps'
}

// Nama lama (sebelum rename 23 Nov 2026) → key preset. Key TIDAK berubah
// (leg/push/pull/easy) supaya plan & sesi lama tetap kepakai: planForKey
// dan semua guard mencocokkan nama lama juga.
export const OLD_PRESET_NAMES: Record<string, string> = {
  leg: 'Leg Day',
  push: 'Push Day',
  pull: 'Pull Day',
  easy: 'Easy Day',
}

export function presetByName(name: string): PlanPreset | undefined {
  return PLAN_PRESETS.find((p) => p.name === name)
    ?? PLAN_PRESETS.find((p) => OLD_PRESET_NAMES[p.key] === name)
}

// Kupas stiker siklus dari nama/label: "[C1-S01] [C1-S01] Leg Day — 3×5"
// → "Leg Day", "[R1-S05] Leg Rehab Iso — W2" → "Leg Rehab Iso", "Leg Day" → "Leg Day".
// Dipakai supaya data lama berstiker bisa dinormalisasi ke nama plan polos,
// bukan ditulis ulang tiap load (bug Fase 1: planName berstiker).
export function stripSticker(name: string): string {
  let bare = name.trim()
  // Kupas prefix berulang — label ganda punya dua prefix berurutan.
  while (/^\[(C|R)\d+-S\d+\]\s*/.test(bare)) {
    bare = bare.replace(/^\[(C|R)\d+-S\d+\]\s*/, '')
  }
  return bare.split(' — ')[0].trim()
}

export function presetByLooseName(name: string): PlanPreset | undefined {
  const bare = stripSticker(name).toLowerCase()
  return PLAN_PRESETS.find((p) => p.name.toLowerCase() === bare)
    // Nama lama ("Leg Day", "Push Day", ...) tetap ter-resolve ke preset baru.
    ?? PLAN_PRESETS.find((p) => (OLD_PRESET_NAMES[p.key] ?? '').toLowerCase() === bare)
    // Label siklus pakai bentuk pendek: "Push" (bukan "Push Day"), "Cardio" (bukan "Cardio Day").
    ?? PLAN_PRESETS.find((p) => p.name.toLowerCase() === `${bare} day`)
    ?? PLAN_PRESETS.find((p) => (OLD_PRESET_NAMES[p.key] ?? '').toLowerCase() === `${bare} day`)
    ?? PLAN_PRESETS.find((p) => p.shortLabel.toLowerCase() === bare)
}

export function isRest(name: string): boolean {
  return presetByName(name)?.key === 'rest'
}

// Longgar: benar juga bila nama ditempeli stiker siklus ("[C5-S05] Rest Day — 3×3").
// Dipakai semua guard runtime agar Rest rusak-data tetap diperlakukan sebagai istirahat.
export function isRestLoose(name: string): boolean {
  return presetByLooseName(name)?.key === 'rest'
}

export function shortLabelFor(name: string): string {
  return (presetByName(name) ?? presetByLooseName(name))?.shortLabel ?? ''
}

export function dotColorFor(name: string): string | undefined {
  return (presetByName(name) ?? presetByLooseName(name))?.dotColor
}
