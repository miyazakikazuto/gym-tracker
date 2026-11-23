// Bobot ramp untuk tambah-set-cepat: dari beban awal ke beban puncak,
// langkah rata, dibulatkan ke 0,5 kg terdekat (stepper beban di UI = 0,5 kg).
// Contoh: 50 → 70, 3 set = [50, 60, 70]; 2 set = [50, 70] (tanpa tengah);
// 1 set = [puncak] saja. Puncak < awal juga boleh (drop set, ramp turun).
export function rampWeights(startKg: number, peakKg: number, count: number): number[] {
  const n = Math.max(1, Math.min(7, Math.floor(count) || 1))
  if (n === 1) return [roundHalf(Math.max(0, peakKg))]
  const step = (peakKg - startKg) / (n - 1)
  return Array.from({ length: n }, (_, i) => roundHalf(Math.max(0, startKg + step * i)))
}

function roundHalf(v: number): number {
  return Math.round(v * 2) / 2
}
