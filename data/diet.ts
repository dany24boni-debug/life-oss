/**
 * Dieta (run-09 prompt 1) — la matematica pura del giorno alimentare.
 *
 * TUTTA l'aritmetica è su interi (la lezione dei centesimi di Spese):
 * kcal intere, macro in DECIGRAMMI interi. I valori per-basis degli
 * alimenti (validati a un decimale dallo schema) entrano una volta sola
 * da `toDg`/`itemTotals` con un solo arrotondamento; da lì in poi solo
 * somme intere — mai scie di float nei totali.
 *
 * Semantica delle varianti: una variante SOSTITUISCE la composizione
 * base del pasto (è un'alternativa, non un'aggiunta). La selezione del
 * giorno è la base quando il log non sceglie nulla o quando la variante
 * scelta non esiste più (fallback onesto, mai una selezione rotta).
 *
 * `dayTotals` conta i pasti MANGIATI più tutti gli extra del giorno —
 * è il "consumato finora" dell'header, non il totale teorico del piano.
 */

import { weekdayOfDay } from "./habits";
import type {
  DietExtra,
  DietMeal,
  DietPlan,
  Food,
  IsoDay,
  MealItem,
  MealLog,
  MealVariant,
} from "./schemas";

/* ── Totali interi ───────────────────────────────────────────────────── */

/** Totali di kcal (intere) e macro (decigrammi INTERI). */
export type MacroTotals = {
  kcal: number;
  protein_dg: number;
  carbs_dg: number;
  fat_dg: number;
};

export const ZERO_TOTALS: MacroTotals = {
  kcal: 0,
  protein_dg: 0,
  carbs_dg: 0,
  fat_dg: 0,
};

export function addTotals(a: MacroTotals, b: MacroTotals): MacroTotals {
  return {
    kcal: a.kcal + b.kcal,
    protein_dg: a.protein_dg + b.protein_dg,
    carbs_dg: a.carbs_dg + b.carbs_dg,
    fat_dg: a.fat_dg + b.fat_dg,
  };
}

function sumTotals(list: Array<MacroTotals | null>): MacroTotals {
  return list.reduce<MacroTotals>(
    (acc, t) => (t === null ? acc : addTotals(acc, t)),
    ZERO_TOTALS,
  );
}

/** Grammi (al più un decimale) → decigrammi interi. Unico punto d'ingresso. */
export function toDg(grams: number): number {
  return Math.round(grams * 10);
}

/**
 * Totali di una riga: quantità × valori per-basis dell'alimento.
 * per100g: qty è in grammi (fattore qty/100); per_piece: qty è in pezzi.
 * Un solo arrotondamento, alla fine — poi solo somme intere.
 */
export function itemTotals(
  qty: number,
  food: Pick<Food, "basis" | "kcal" | "protein_g" | "carbs_g" | "fat_g">,
): MacroTotals {
  const factor = food.basis === "per100g" ? qty / 100 : qty;
  return {
    kcal: Math.round(food.kcal * factor),
    protein_dg: Math.round(food.protein_g * 10 * factor),
    carbs_dg: Math.round(food.carbs_g * 10 * factor),
    fat_dg: Math.round(food.fat_g * 10 * factor),
  };
}

/* ── Viste composte del giorno ───────────────────────────────────────── */

/** Riga con l'alimento risolto; food null (eliminato) = fuori dai conti. */
export type DietItemView = {
  item: MealItem;
  food: Food | null;
  /** null quando l'alimento non è risolvibile: la riga non conta. */
  totals: MacroTotals | null;
};

export type DietVariantView = {
  variant: MealVariant;
  items: DietItemView[];
  totals: MacroTotals;
};

export type DayDietMeal = {
  meal: DietMeal;
  baseItems: DietItemView[];
  baseTotals: MacroTotals;
  variants: DietVariantView[];
  log: MealLog | null;
  /** La variante EFFETTIVA della selezione (scelta viva; eliminata → base). */
  chosenVariantId: string | null;
  eaten: boolean;
  selectionItems: DietItemView[];
  selectionTotals: MacroTotals;
};

export type DayDiet = {
  date: IsoDay;
  /** 1 = lunedì … 7 = domenica (DST-immune, da weekdayOfDay). */
  weekday: number;
  /** Il piano attivo; null = nessun piano (meals sempre []). */
  plan: DietPlan | null;
  meals: DayDietMeal[];
};

export type DietExtraView = {
  extra: DietExtra;
  food: Food | null;
  /** null quando l'extra referenzia un alimento non più risolvibile. */
  totals: MacroTotals | null;
};

function itemView(item: MealItem, foodById: Map<string, Food>): DietItemView {
  const food = foodById.get(item.food_id) ?? null;
  return {
    item,
    food,
    totals: food === null ? null : itemTotals(item.qty, food),
  };
}

const bySort = <T extends { sort_order: number; created_at: string }>(
  a: T,
  b: T,
): number => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);

/**
 * Compone i pasti del giorno: filtra per weekday, risolve righe/varianti/
 * log e calcola i totali per pasto e per selezione. Pura: il repo fa solo
 * le query e delega qui.
 */
export function composeDayMeals(input: {
  date: IsoDay;
  meals: DietMeal[];
  variants: MealVariant[];
  items: MealItem[];
  logs: MealLog[];
  foods: Food[];
}): DayDietMeal[] {
  const weekday = weekdayOfDay(input.date);
  const foodById = new Map(input.foods.map((f) => [f.id, f]));
  const logByMeal = new Map(input.logs.map((l) => [l.meal_id, l]));
  const variantsByMeal = new Map<string, MealVariant[]>();
  for (const v of input.variants) {
    const list = variantsByMeal.get(v.meal_id) ?? [];
    list.push(v);
    variantsByMeal.set(v.meal_id, list);
  }
  const itemsByMeal = new Map<string, MealItem[]>();
  for (const i of input.items) {
    const list = itemsByMeal.get(i.meal_id) ?? [];
    list.push(i);
    itemsByMeal.set(i.meal_id, list);
  }

  return input.meals
    .filter((m) => m.weekday === weekday)
    .sort(bySort)
    .map((meal) => {
      const mealItems = (itemsByMeal.get(meal.id) ?? []).sort(bySort);
      const baseItems = mealItems
        .filter((i) => i.variant_id === null)
        .map((i) => itemView(i, foodById));
      const baseTotals = sumTotals(baseItems.map((v) => v.totals));
      const variants: DietVariantView[] = (variantsByMeal.get(meal.id) ?? [])
        .sort(bySort)
        .map((variant) => {
          const items = mealItems
            .filter((i) => i.variant_id === variant.id)
            .map((i) => itemView(i, foodById));
          return { variant, items, totals: sumTotals(items.map((v) => v.totals)) };
        });

      const log = logByMeal.get(meal.id) ?? null;
      const chosen =
        log?.variant_id != null
          ? (variants.find((v) => v.variant.id === log.variant_id) ?? null)
          : null;
      const selectionItems = chosen ? chosen.items : baseItems;
      const selectionTotals = chosen ? chosen.totals : baseTotals;

      return {
        meal,
        baseItems,
        baseTotals,
        variants,
        log,
        chosenVariantId: chosen?.variant.id ?? null,
        eaten: log?.eaten ?? false,
        selectionItems,
        selectionTotals,
      };
    });
}

/** Vista di un extra con l'alimento risolto (null = voce libera o perso). */
export function extraView(extra: DietExtra, food: Food | null): DietExtraView {
  if (extra.food_id !== null) {
    return {
      extra,
      food,
      totals:
        food === null || extra.qty === null
          ? null
          : itemTotals(extra.qty, food),
    };
  }
  return {
    extra,
    food: null,
    totals: {
      kcal: extra.kcal ?? 0,
      protein_dg: toDg(extra.protein_g ?? 0),
      carbs_dg: toDg(extra.carbs_g ?? 0),
      fat_dg: toDg(extra.fat_g ?? 0),
    },
  };
}

/** Consumato del giorno: pasti MANGIATI + tutti gli extra. */
export function dayTotals(
  day: Pick<DayDiet, "meals">,
  extras: DietExtraView[],
): MacroTotals {
  const eaten = day.meals
    .filter((m) => m.eaten)
    .map((m) => m.selectionTotals as MacroTotals | null);
  return addTotals(sumTotals(eaten), sumTotals(extras.map((e) => e.totals)));
}

/* ── Confronto con gli obiettivi ─────────────────────────────────────── */

/** Una riga obiettivo, tutta nella STESSA unità intera. */
export type TargetLine = {
  target: number;
  consumed: number;
  /** Può essere negativo: sopra l'obiettivo, onestamente. */
  remaining: number;
};

/**
 * Confronto col profilo: kcal in kcal intere, proteine in DECIGRAMMI
 * interi (il target in grammi viene convertito qui). Riga null quando
 * manca l'obiettivo — mai barre su numeri inventati.
 */
export function remainingVsTarget(
  totals: MacroTotals,
  calorieTargetKcal: number | null,
  proteinTargetGrams: number | null,
): { kcal: TargetLine | null; protein_dg: TargetLine | null } {
  return {
    kcal:
      calorieTargetKcal === null
        ? null
        : {
            target: calorieTargetKcal,
            consumed: totals.kcal,
            remaining: calorieTargetKcal - totals.kcal,
          },
    protein_dg:
      proteinTargetGrams === null
        ? null
        : {
            target: proteinTargetGrams * 10,
            consumed: totals.protein_dg,
            remaining: proteinTargetGrams * 10 - totals.protein_dg,
          },
  };
}
