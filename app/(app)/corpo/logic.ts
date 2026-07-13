/**
 * Logica pura di /corpo (run-07 prompt 4) — stepper del peso, formato
 * italiano, punti del grafico con banda min-max. Zero side effect.
 */

import type { BodyEntry } from "@/data/schemas";

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

export type WeightChart = {
  /** Punti "x,y" per la polyline (asse y tra min e max, padding 3). */
  path: string;
  minKg: number;
  maxKg: number;
  /** y in viewBox della banda min-max (per il rettangolo quieto). */
  bandTopY: number;
  bandBottomY: number;
  first: BodyEntry;
  last: BodyEntry;
};

/**
 * Il grafico del trend: pesate del range (già in ordine crescente),
 * scalate su una viewBox w×h; la banda orizzontale [min, max] è il
 * range reale della finestra. Meno di un punto → null.
 */
export function buildWeightChart(
  entries: readonly BodyEntry[],
  w: number,
  h: number,
): WeightChart | null {
  if (entries.length === 0) return null;
  const pad = 3;
  const weights = entries.map((e) => e.weight_kg);
  const minKg = Math.min(...weights);
  const maxKg = Math.max(...weights);
  const span = maxKg - minKg;

  const yFor = (kg: number) =>
    span === 0 ? h / 2 : pad + (h - pad * 2) * (1 - (kg - minKg) / span);

  const path = entries
    .map((e, i) => {
      const x =
        entries.length === 1
          ? w / 2
          : pad + (i * (w - pad * 2)) / (entries.length - 1);
      const y = yFor(e.weight_kg);
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
    })
    .join(" ");

  return {
    path,
    minKg,
    maxKg,
    bandTopY: Math.round(yFor(maxKg) * 10) / 10,
    bandBottomY: Math.round(yFor(minKg) * 10) / 10,
    first: entries[0],
    last: entries[entries.length - 1],
  };
}
