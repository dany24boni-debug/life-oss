/**
 * Logica pura di /corpo (run-07 prompt 4) — stepper del peso e formato
 * italiano. Zero side effect. ATTENZIONE residenza: questo è un modulo-
 * HOME (today-tiles importa i formatter del tile Peso) — la matematica
 * del grafico vive in trend.ts, che la home non importa (run-13).
 */

/** Passo ±0,1 kg nel dominio dello schema (20..400). */
export function stepBodyWeight(current: number, direction: 1 | -1): number {
  const next = Math.round((current + direction * 0.1) * 10) / 10;
  return Math.max(20, Math.min(400, next));
}

const KG = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  // Mai raggiungibile nel dominio 20..400 kg, ma la landmine it-IT
  // (niente separatore sotto 10.000) si disinnesca OVUNQUE, greppabile.
  useGrouping: "always",
});

/** "82,4 kg" — sempre un decimale (la bilancia parla così). */
export function formatBodyKg(kg: number): string {
  return `${KG.format(kg)} kg`;
}

/** Delta con segno per il confronto quieto: "−0,3 kg" / "+0,2 kg". */
export function formatBodyDelta(kg: number): string {
  if (kg === 0) return "=";
  const sign = kg > 0 ? "+" : "−";
  return `${sign}${KG.format(Math.abs(kg))} kg`;
}
