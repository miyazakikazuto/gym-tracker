// Parsing input angka desimal — terima koma (format Indonesia) maupun titik.
// Dipakai input berat badan (Weight) & input set (Session).
export function parseDecimal(raw: string): number | null {
  const n = Number(raw.trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
