/**
 * Logica pura della UI Dieta — formattazione it-IT, ciclo delle
 * varianti, tono delle barre obiettivo, parsing degli input e somme
 * per l'authoring. Tutto testato in logic.test.ts; i componenti non
 * fanno mai questa matematica.
 */

import {
  addTotals,
  itemTotals,
  ZERO_TOTALS,
  type MacroTotals,
} from "@/data/diet";
import type { Food, FoodBasis, MealItem } from "@/data/schemas";

/* ── Formattazione (useGrouping SEMPRE: la landmine it-IT) ───────────── */

export function formatInt(n: number): string {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 0,
    useGrouping: "always",
  }).format(n);
}

/** Grammi da decigrammi interi: "92,5" — solo display, mai aritmetica. */
export function formatGramsFromDg(dg: number): string {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 1,
    useGrouping: "always",
  }).format(dg / 10);
}

/** "447 kcal · 45,3 g proteine" — la riga dei totali di un pasto. */
export function kcalProteinLine(totals: MacroTotals): string {
  return `${formatInt(totals.kcal)} kcal · ${formatGramsFromDg(totals.protein_dg)} g proteine`;
}

export function qtyUnit(basis: FoodBasis): string {
  return basis === "per100g" ? "g" : "pz";
}

/** "80 g", "1,5 pz". */
export function formatQty(qty: number, basis: FoodBasis): string {
  const n = new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 1,
    useGrouping: "always",
  }).format(qty);
  return `${n} ${qtyUnit(basis)}`;
}

/* ── Varianti ────────────────────────────────────────────────────────── */

/**
 * Il tap sul chip cicla: base → prima variante → … → base. Con più di
 * due opzioni la UI apre la scelta esplicita (BottomSheet) invece di
 * ciclare alla cieca.
 */
export function cycleSelection(
  current: string | null,
  variantIds: readonly string[],
): string | null {
  if (variantIds.length === 0) return null;
  if (current === null) return variantIds[0];
  const idx = variantIds.indexOf(current);
  if (idx === -1 || idx === variantIds.length - 1) return null;
  return variantIds[idx + 1];
}

/* ── Barre obiettivo ─────────────────────────────────────────────────── */

/**
 * Sopra l'obiettivo la barra resta del suo colore fino al +10%: solo
 * oltre diventa segnale (mai copy colpevolizzante — solo il colore).
 */
export function barTone(
  base: "ember" | "salvia",
  consumed: number,
  target: number,
): "ember" | "salvia" | "segnale" {
  return consumed > target * 1.1 ? "segnale" : base;
}

/* ── Parsing input (virgola o punto; garbage → null) ─────────────────── */

/** Quantità: positiva, al più un decimale, tetto 10.000. */
export function parseQtyInput(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  if (cleaned === "" || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Math.round(Number.parseFloat(cleaned) * 10) / 10;
  if (!Number.isFinite(n) || n <= 0 || n > 10_000) return null;
  return n;
}

/** kcal: intere 0..9000. */
export function parseKcalInput(raw: string): number | null {
  const cleaned = raw.trim();
  if (!/^\d+$/.test(cleaned)) return null;
  const n = Number.parseInt(cleaned, 10);
  return n >= 0 && n <= 9000 ? n : null;
}

/** Macro in grammi: 0..1000, al più un decimale. */
export function parseMacroInput(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  if (cleaned === "" || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Math.round(Number.parseFloat(cleaned) * 10) / 10;
  return n >= 0 && n <= 1000 ? n : null;
}

/* ── Stepper ─────────────────────────────────────────────────────────── */

/** Passo dello stepper quantità: 10 g oppure 1 pezzo. */
export function qtyStep(basis: FoodBasis): number {
  return basis === "per100g" ? 10 : 1;
}

/** La quantità di partenza: quella proposta dall'alimento, o la basis. */
export function defaultQtyFor(
  food: Pick<Food, "basis" | "default_qty">,
): number {
  return food.default_qty ?? (food.basis === "per100g" ? 100 : 1);
}

/* ── Somme per l'authoring (per-pasto e per-giorno, live) ────────────── */

/** Somma i totali delle righe risolvibili (alimenti persi: fuori). */
export function sumItemTotals(
  items: readonly MealItem[],
  foodById: ReadonlyMap<string, Food>,
): MacroTotals {
  let acc = ZERO_TOTALS;
  for (const item of items) {
    const food = foodById.get(item.food_id);
    if (!food) continue;
    acc = addTotals(acc, itemTotals(item.qty, food));
  }
  return acc;
}
