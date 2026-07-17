/**
 * Il momento PR (run-12, PROP-gym-04/WOW-02) — logica pura del record
 * al set. Vive in un modulo SEPARATO da logic.ts di proposito: la home
 * importa gym/logic (formatKg nei tile) e webpack non tree-shaka gli
 * export tra moduli (lezione run-11 P2, ri-misurata qui: +385 B sul
 * chunk congelato di Oggi quando queste due funzioni stavano in
 * logic.ts). Consumer: session-grid, scheda-view — mai la home.
 */

import type { GymSet } from "@/data/schemas";
import { computePRs } from "./logic";

/**
 * PR di peso AL MOMENTO del set: il carico batte strettamente il
 * massimo su tutti i set precedenti dell'esercizio (stessa regola di
 * newRecords: serve un passato — la prima volta non è un record — e i
 * corpo-libero non concorrono). `priorSets` = la storia SENZA il set
 * che si sta confermando/modificando.
 */
export function weightPrCheck(
  weightKg: number | null,
  priorSets: readonly GymSet[],
): { isPr: boolean; previousKg: number | null } {
  const previousKg = computePRs(priorSets).maxWeightKg;
  const isPr =
    weightKg !== null &&
    weightKg > 0 &&
    previousKg !== null &&
    weightKg > previousKg;
  return { isPr, previousKg };
}

/**
 * Gli id dei set che ERANO PR di peso quando furono fatti (la storia
 * riletta in ordine cronologico): il marcatore permanente della griglia
 * storica. Ordine per done_at — null (import legacy) in testa come
 * "storia remota" — poi id (UUIDv7 = ordine di creazione):
 * deterministico anche con input mescolato.
 */
export function weightPrSetIds(sets: readonly GymSet[]): Set<string> {
  const chrono = [...sets].sort(
    (a, b) =>
      (a.done_at ?? "").localeCompare(b.done_at ?? "") ||
      a.id.localeCompare(b.id),
  );
  const out = new Set<string>();
  let maxKg: number | null = null;
  for (const s of chrono) {
    if (s.weight_kg === null || s.weight_kg <= 0) continue;
    if (maxKg !== null && s.weight_kg > maxKg) out.add(s.id);
    if (maxKg === null || s.weight_kg > maxKg) maxKg = s.weight_kg;
  }
  return out;
}
