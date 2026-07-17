/**
 * La matematica del TREND di /corpo — separata da logic.ts perché quella
 * è un modulo-home (today-tiles importa i formatter del tile Peso) e
 * webpack non tree-shaka gli export tra moduli: ogni byte qui NON viaggia
 * col chunk congelato di Oggi (la legge di residenza run-12, terzo caso).
 * Consumer: solo corpo-screen (e i test).
 */

import type { BodyEntry } from "@/data/schemas";

export type WeightChart = {
  /** Punti "x,y" per la polyline (asse y tra min e max, padding 3). */
  path: string;
  /**
   * PROP-corpo-01 (run-13 P4a): la media mobile a 7 giorni — polyline
   * quieta sopra i punti grezzi, stessa scala. Null con un solo punto
   * (niente segmento da disegnare).
   */
  avgPath: string | null;
  minKg: number;
  maxKg: number;
  /** y in viewBox della banda min-max (per il rettangolo quieto). */
  bandTopY: number;
  bandBottomY: number;
  first: BodyEntry;
  last: BodyEntry;
};

const MS_DAY = 86_400_000;

/** Giorno ISO → numero di giorni UTC (puro: Date.parse su stringa fissa). */
function dayNum(date: string): number {
  return Math.floor(Date.parse(date) / MS_DAY);
}

/**
 * Media mobile TRAILING a 7 giorni di calendario: per ogni pesata, la
 * media delle pesate nella finestra [giorno−6, giorno]. Con pesate rade
 * (finestra vuota a parte sé) la media È il punto grezzo — onesto.
 * Input in ordine crescente di data (la convenzione del selettore).
 */
export function trailingAvg7(entries: readonly BodyEntry[]): number[] {
  const days = entries.map((e) => dayNum(e.date));
  return entries.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0 && days[i] - days[j] <= 6; j--) {
      sum += entries[j].weight_kg;
      n += 1;
    }
    return sum / n;
  });
}

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
  const xFor = (i: number) =>
    entries.length === 1
      ? w / 2
      : pad + (i * (w - pad * 2)) / (entries.length - 1);
  const point = (x: number, y: number) =>
    `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;

  const path = entries
    .map((e, i) => point(xFor(i), yFor(e.weight_kg)))
    .join(" ");

  // La media di valori nel range [min, max] resta nel range: la scala
  // condivisa con i punti grezzi è corretta per costruzione.
  const avgPath =
    entries.length < 2
      ? null
      : trailingAvg7(entries)
          .map((kg, i) => point(xFor(i), yFor(kg)))
          .join(" ");

  return {
    path,
    avgPath,
    minKg,
    maxKg,
    bandTopY: Math.round(yFor(maxKg) * 10) / 10,
    bandBottomY: Math.round(yFor(minKg) * 10) / 10,
    first: entries[0],
    last: entries[entries.length - 1],
  };
}
