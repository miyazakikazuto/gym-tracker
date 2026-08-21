// Faktor kontribusi otot sekunder per gerakan (berdasarkan pola nama).
// Volume satu set dibagi ke otot sekunder: volume × faktor (0..1).
// Pencocokan: nama lowercase, first-match-wins — entri spesifik diletakkan
// sebelum yang generik (mis. 'hack squat' sebelum 'squat', 'incline bench' sebelum 'bench press').
// Otot primer tetap dari muscleGroup gerakan di Library — tabel ini hanya menambah otot sekunder.

export interface SecondaryFactor {
  group: string
  factor: number
}

interface MuscleMapEntry {
  patterns: string[]
  secondary: SecondaryFactor[]
}

const TABLE: MuscleMapEntry[] = [
  // ===== PUSH =====
  // Incline spesifik → push exercises (Incline Row/Curl match pattern row/curl di bawah)
  { patterns: ['incline bench', 'incline dumbbell press', 'incline press'], secondary: [{ group: 'Bahu', factor: 0.4 }, { group: 'Trisep', factor: 0.4 }] },
  { patterns: ['chest press', 'machine press'], secondary: [{ group: 'Trisep', factor: 0.5 }, { group: 'Bahu', factor: 0.3 }] },
  { patterns: ['bench press', 'flat bench'], secondary: [{ group: 'Trisep', factor: 0.5 }, { group: 'Bahu', factor: 0.3 }] },
  { patterns: ['cable crossover', 'cable fly'], secondary: [{ group: 'Bahu', factor: 0.1 }, { group: 'Trisep', factor: 0.1 }] },
  { patterns: ['overhead press', 'shoulder press', 'military press', 'ohp'], secondary: [{ group: 'Trisep', factor: 0.5 }, { group: 'Dada', factor: 0.2 }] },
  { patterns: ['front raise'], secondary: [{ group: 'Dada', factor: 0.2 }] },
  { patterns: ['rear delt', 'reverse fly', 'reverse pec'], secondary: [] },
  { patterns: ['fly', 'pec deck'], secondary: [{ group: 'Bahu', factor: 0.1 }, { group: 'Trisep', factor: 0.1 }] },
  { patterns: ['push up', 'pushup', 'push-up'], secondary: [{ group: 'Trisep', factor: 0.4 }, { group: 'Bahu', factor: 0.2 }] },
  { patterns: ['pushdown', 'push down', 'tricep extension', 'triceps extension'], secondary: [] },
  { patterns: ['dips', 'dip'], secondary: [{ group: 'Dada', factor: 0.5 }, { group: 'Bahu', factor: 0.2 }] },

  // ===== PULL =====
  { patterns: ['chin up', 'chinup', 'chin-up'], secondary: [{ group: 'Bisep', factor: 0.7 }, { group: 'Forearm', factor: 0.2 }] },
  { patterns: ['pull up', 'pullup', 'pull-up'], secondary: [{ group: 'Bisep', factor: 0.5 }, { group: 'Forearm', factor: 0.2 }] },
  { patterns: ['lat pulldown', 'lat pull down', 'lat pull'], secondary: [{ group: 'Bisep', factor: 0.5 }, { group: 'Forearm', factor: 0.2 }] },
  { patterns: ['hammer curl'], secondary: [{ group: 'Forearm', factor: 0.5 }] },
  { patterns: ['leg curl'], secondary: [] },
  { patterns: ['bicep curl', 'biceps curl', 'preacher curl', 'curl'], secondary: [{ group: 'Forearm', factor: 0.3 }] },
  { patterns: ['shrugs', 'shrug'], secondary: [{ group: 'Bahu', factor: 0.3 }] },
  { patterns: ['face pull'], secondary: [{ group: 'Punggung', factor: 0.3 }, { group: 'Bisep', factor: 0.1 }] },
  { patterns: ['incline dumbbell row', 'incline db row', 'incline row', 'single db row', 'single arm row', 'one arm row', 'db row', 'dumbbell row'], secondary: [{ group: 'Bisep', factor: 0.4 }, { group: 'Forearm', factor: 0.2 }] },
  { patterns: ['cable row', 'seated row'], secondary: [{ group: 'Bisep', factor: 0.4 }, { group: 'Forearm', factor: 0.1 }] },
  { patterns: ['barbell row', 'bent over row', 'pendlay row', 't-bar row', 'tbar row'], secondary: [{ group: 'Bisep', factor: 0.4 }, { group: 'Forearm', factor: 0.2 }] },

  // ===== LEG =====
  { patterns: ['reverse hack squat'], secondary: [{ group: 'Punggung', factor: 0.2 }, { group: 'Core', factor: 0.3 }] },
  { patterns: ['hack squat'], secondary: [{ group: 'Punggung', factor: 0.1 }, { group: 'Core', factor: 0.2 }] },
  { patterns: ['sumo deadlift'], secondary: [{ group: 'Punggung', factor: 0.4 }, { group: 'Core', factor: 0.3 }] },
  { patterns: ['romanian deadlift', 'rdl', 'stiff leg deadlift', 'stiff-legged deadlift'], secondary: [{ group: 'Punggung', factor: 0.4 }, { group: 'Core', factor: 0.3 }] },
  { patterns: ['conventional deadlift', 'deadlift'], secondary: [{ group: 'Punggung', factor: 1.0 }, { group: 'Core', factor: 0.4 }] },
  { patterns: ['bss', 'bulgarian split squat', 'split squat'], secondary: [{ group: 'Core', factor: 0.3 }] },
  { patterns: ['hip thrust', 'glute bridge'], secondary: [{ group: 'Core', factor: 0.3 }] },
  { patterns: ['squat'], secondary: [{ group: 'Punggung', factor: 0.3 }, { group: 'Core', factor: 0.4 }] },
  { patterns: ['leg press'], secondary: [{ group: 'Core', factor: 0.1 }] },
  { patterns: ['leg extension', 'leg ext'], secondary: [] },
  { patterns: ['calf raise', 'calf'], secondary: [] },
  { patterns: ['plank'], secondary: [] },
]

export function secondaryFactorsFor(name: string): SecondaryFactor[] {
  const n = name.trim().toLowerCase()
  if (!n) return []
  for (const entry of TABLE) {
    if (entry.patterns.some((p) => n.includes(p))) return entry.secondary
  }
  return []
}
