/**
 * Plate calculator (run-12, PROP-gym-03/WOW-01) — matematica pura, zero
 * side effect: dato un peso target, il bilanciere e i dischi posseduti
 * (dal profilo attrezzatura sincronizzato, P1), i dischi DA METTERE PER
 * LATO. Tutta la matematica è in GRAMMI INTERI (la lezione spese-cents /
 * dieta: una conversione al bordo, poi solo somme intere — mai float a
 * metà conto).
 *
 * L'algoritmo non è il greedy nudo: un greedy sui tagli decrescenti
 * sbaglia i profili non-canonici (target 15/lato con dischi {20, 15}:
 * prende il 20 e fallisce, mentre 15 è esatto). Si enumerano invece le
 * somme per-lato RAGGIUNGIBILI (subset-sum limitato dalle coppie
 * possedute) con un testimone per somma; processando i tagli in ordine
 * decrescente la prima rappresentazione trovata è quella coi dischi più
 * grossi — lo spirito del greedy, senza i suoi falsi negativi. Con i cap
 * dello zod (≤24 tagli, n ≤ 40, kg ≤ 100) l'enumerazione è banale.
 *
 * Peso irraggiungibile → si risponde col PIÙ VICINO raggiungibile
 * (anche sopra il target; a pari distanza vince il più leggero), come
 * chiede la PROP: mai un vicolo cieco, sempre un numero onesto.
 */

export type PlateCount = {
  /** Peso del singolo disco, in kg. */
  kg: number;
  /** Quanti dischi di questo taglio PER LATO. */
  count: number;
};

export type PlateBreakdown =
  /** Il target è esattamente il bilanciere: si carica nudo. */
  | { kind: "bar-only" }
  /** Il target si raggiunge esatto: dischi per lato, tagli decrescenti. */
  | { kind: "exact"; perSide: PlateCount[] }
  /**
   * Il target NON si raggiunge coi dischi posseduti: `totalKg` è il
   * carico totale più vicino (bilanciere incluso; `perSide` può essere
   * vuoto = solo bilanciere, anche quando il target è sotto il
   * bilanciere stesso).
   */
  | { kind: "nearest"; totalKg: number; perSide: PlateCount[] };

const toG = (kg: number) => Math.round(kg * 1000);

export function plateBreakdown(
  targetKg: number,
  barKg: number,
  plates: readonly { kg: number; n: number }[],
): PlateBreakdown {
  const targetG = toG(targetKg);
  const barG = toG(barKg);

  // Coppie utilizzabili per taglio: un disco per lato, quindi floor(n/2)
  // usi possibili (il disco spaiato resta a terra). Tagli decrescenti.
  const pairs = plates
    .map((p) => ({ g: toG(p.kg), pairs: Math.floor(p.n / 2) }))
    .filter((p) => p.g > 0 && p.pairs > 0)
    .sort((a, b) => b.g - a.g);

  if (targetG === barG) return { kind: "bar-only" };
  if (targetG < barG) {
    return { kind: "nearest", totalKg: barG / 1000, perSide: [] };
  }

  const perSideTargetG = Math.round((targetG - barG) / 2);

  // Somme per-lato raggiungibili, con testimone (conteggi per taglio).
  // Snapshot delle somme prima di ogni taglio: ogni taglio si usa al
  // massimo `pairs` volte. Prima rappresentazione trovata = tenuta.
  const cap = perSideTargetG + (pairs[0]?.g ?? 0);
  const reach = new Map<number, number[]>([[0, pairs.map(() => 0)]]);
  pairs.forEach((p, i) => {
    for (const [sum, counts] of [...reach.entries()]) {
      for (let k = 1; k <= p.pairs; k++) {
        const next = sum + k * p.g;
        if (next > cap) break;
        if (!reach.has(next)) {
          const c = [...counts];
          c[i] += k;
          reach.set(next, c);
        }
      }
    }
  });

  // La somma più vicina al target per lato; a pari distanza la più
  // bassa (meglio un filo sotto che un filo sopra).
  let bestSum = 0;
  let bestCounts = reach.get(0) as number[];
  for (const [sum, counts] of reach) {
    const d = Math.abs(sum - perSideTargetG);
    const bestD = Math.abs(bestSum - perSideTargetG);
    if (d < bestD || (d === bestD && sum < bestSum)) {
      bestSum = sum;
      bestCounts = counts;
    }
  }

  const perSide: PlateCount[] = pairs
    .map((p, i) => ({ kg: p.g / 1000, count: bestCounts[i] }))
    .filter((p) => p.count > 0);

  if (bestSum === perSideTargetG) {
    return perSide.length === 0
      ? { kind: "bar-only" }
      : { kind: "exact", perSide };
  }
  return { kind: "nearest", totalKg: (barG + bestSum * 2) / 1000, perSide };
}
