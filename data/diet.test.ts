import { describe, expect, it } from "vitest";
import {
  addTotals,
  composeDayMeals,
  dayTotals,
  extraView,
  itemTotals,
  remainingVsTarget,
  toDg,
  ZERO_TOTALS,
  type MacroTotals,
} from "./diet";
import type {
  DietMeal,
  Food,
  MealItem,
  MealLog,
  MealVariant,
} from "./schemas";

/* ── Fixture minime ──────────────────────────────────────────────────── */

const T0 = "2026-07-01T08:00:00.000Z";
const audit = { created_at: T0, updated_at: T0, deleted_at: null };

function food(over: Partial<Food> & { id: string }): Food {
  return {
    name: "Alimento",
    basis: "per100g",
    kcal: 100,
    protein_g: 10,
    carbs_g: 10,
    fat_g: 10,
    default_qty: null,
    archived_at: null,
    ...audit,
    ...over,
  };
}

function meal(over: Partial<DietMeal> & { id: string }): DietMeal {
  return {
    plan_id: "p1",
    weekday: 1,
    name: "Pranzo",
    sort_order: 0,
    ...audit,
    ...over,
  };
}

function item(over: Partial<MealItem> & { id: string }): MealItem {
  return {
    meal_id: "m1",
    variant_id: null,
    food_id: "f1",
    qty: 100,
    sort_order: 0,
    ...audit,
    ...over,
  };
}

function variant(over: Partial<MealVariant> & { id: string }): MealVariant {
  return {
    meal_id: "m1",
    name: "Variante B",
    sort_order: 0,
    training: null,
    ...audit,
    ...over,
  };
}

function log(over: Partial<MealLog> & { id: string }): MealLog {
  return {
    meal_id: "m1",
    date: "2026-07-13",
    eaten: false,
    variant_id: null,
    ...audit,
    ...over,
  };
}

/* ── Matematica intera ───────────────────────────────────────────────── */

describe("itemTotals — kcal intere, macro in decigrammi", () => {
  it("per100g: la pasta del foglio (80 g a 353 kcal/100 g)", () => {
    const pasta = food({
      id: "f1",
      kcal: 353,
      protein_g: 13.5,
      carbs_g: 70.2,
      fat_g: 1.8,
    });
    const t = itemTotals(80, pasta);
    expect(t.kcal).toBe(282); // 353 × 0,8 = 282,4 → 282, intero
    expect(t.protein_dg).toBe(108); // 13,5 g × 0,8 = 10,8 g = 108 dg
    expect(t.carbs_dg).toBe(562); // 70,2 × 0,8 = 56,16 → 561,6 dg → 562
    expect(t.fat_dg).toBe(14);
    expect(Number.isInteger(t.kcal)).toBe(true);
    expect(Number.isInteger(t.protein_dg)).toBe(true);
  });

  it("per_piece: 2 uova da 78 kcal e 6,3 g di proteine l'una", () => {
    const uovo = food({
      id: "f2",
      basis: "per_piece",
      kcal: 78,
      protein_g: 6.3,
      carbs_g: 0.6,
      fat_g: 5.3,
    });
    const t = itemTotals(2, uovo);
    expect(t).toEqual({ kcal: 156, protein_dg: 126, carbs_dg: 12, fat_dg: 106 });
  });

  it("mezzi pezzi: 1,5 pezzi arrotondano una volta sola, alla fine", () => {
    const t = itemTotals(1.5, food({ id: "f3", basis: "per_piece", kcal: 95, protein_g: 0.5 }));
    expect(t.kcal).toBe(143); // 142,5 → 143
    expect(t.protein_dg).toBe(8); // 0,5 × 10 × 1,5 = 7,5 → 8
  });

  it("niente scie di float: somme ripetute restano intere", () => {
    // 0,1 + 0,2 in float è 0,30000000000000004; in decigrammi è 1 + 2 = 3.
    const a = itemTotals(100, food({ id: "f4", protein_g: 0.1, kcal: 1 }));
    const b = itemTotals(100, food({ id: "f5", protein_g: 0.2, kcal: 2 }));
    let sum: MacroTotals = ZERO_TOTALS;
    for (let i = 0; i < 100; i++) sum = addTotals(sum, addTotals(a, b));
    expect(sum.protein_dg).toBe(300);
    expect(sum.kcal).toBe(300);
    expect(Number.isInteger(sum.protein_dg)).toBe(true);
  });

  it("toDg arrotonda i grammi a un decimale esatto", () => {
    expect(toDg(0.1)).toBe(1);
    expect(toDg(92.5)).toBe(925);
    expect(toDg(0)).toBe(0);
  });
});

/* ── Composizione del giorno ─────────────────────────────────────────── */

describe("composeDayMeals", () => {
  const foods = [
    food({ id: "f1", kcal: 100, protein_g: 10, carbs_g: 0, fat_g: 0 }),
    food({ id: "f2", kcal: 200, protein_g: 20, carbs_g: 0, fat_g: 0 }),
  ];

  it("filtra per weekday e ordina per sort_order", () => {
    // 2026-07-13 è lunedì (weekday 1).
    const meals = [
      meal({ id: "m2", weekday: 1, name: "Cena", sort_order: 1 }),
      meal({ id: "m1", weekday: 1, name: "Pranzo", sort_order: 0 }),
      meal({ id: "m3", weekday: 2, name: "Martedì" }),
    ];
    const out = composeDayMeals({
      date: "2026-07-13",
      meals,
      variants: [],
      items: [],
      logs: [],
      foods: [],
    });
    expect(out.map((m) => m.meal.name)).toEqual(["Pranzo", "Cena"]);
  });

  it("base e variante: la variante SOSTITUISCE, la selezione segue il log", () => {
    const meals = [meal({ id: "m1", weekday: 1 })];
    const variants = [variant({ id: "v1", meal_id: "m1" })];
    const items = [
      item({ id: "i1", meal_id: "m1", food_id: "f1", qty: 100 }), // base: 100 kcal
      item({ id: "i2", meal_id: "m1", variant_id: "v1", food_id: "f2", qty: 100 }), // variante: 200
    ];
    const senzaLog = composeDayMeals({
      date: "2026-07-13",
      meals,
      variants,
      items,
      logs: [],
      foods,
    })[0];
    expect(senzaLog.baseTotals.kcal).toBe(100);
    expect(senzaLog.variants[0].totals.kcal).toBe(200);
    expect(senzaLog.chosenVariantId).toBeNull();
    expect(senzaLog.selectionTotals.kcal).toBe(100);
    expect(senzaLog.eaten).toBe(false);

    const conVariante = composeDayMeals({
      date: "2026-07-13",
      meals,
      variants,
      items,
      logs: [log({ id: "l1", meal_id: "m1", eaten: true, variant_id: "v1" })],
      foods,
    })[0];
    expect(conVariante.chosenVariantId).toBe("v1");
    expect(conVariante.selectionTotals.kcal).toBe(200);
    expect(conVariante.eaten).toBe(true);
  });

  it("variante scelta non più esistente: fallback onesto alla base", () => {
    const out = composeDayMeals({
      date: "2026-07-13",
      meals: [meal({ id: "m1", weekday: 1 })],
      variants: [], // la variante del log è stata eliminata
      items: [item({ id: "i1", food_id: "f1" })],
      logs: [log({ id: "l1", eaten: true, variant_id: "v-morta" })],
      foods,
    })[0];
    expect(out.chosenVariantId).toBeNull();
    expect(out.selectionTotals.kcal).toBe(100);
  });

  it("alimento non risolvibile: la riga resta visibile ma fuori dai conti", () => {
    const out = composeDayMeals({
      date: "2026-07-13",
      meals: [meal({ id: "m1", weekday: 1 })],
      variants: [],
      items: [
        item({ id: "i1", food_id: "f1", qty: 100 }),
        item({ id: "i2", food_id: "f-perso", qty: 100, sort_order: 1 }),
      ],
      logs: [],
      foods,
    })[0];
    expect(out.baseItems).toHaveLength(2);
    expect(out.baseItems[1].food).toBeNull();
    expect(out.baseItems[1].totals).toBeNull();
    expect(out.baseTotals.kcal).toBe(100); // solo la riga risolta
  });
});

/* ── Totali del giorno e obiettivi ───────────────────────────────────── */

describe("dayTotals + extraView", () => {
  const f1 = food({ id: "f1", kcal: 100, protein_g: 10, carbs_g: 0, fat_g: 0 });

  function dayWith(eatenKcal: Array<{ kcal: number; eaten: boolean }>) {
    return {
      meals: eatenKcal.map((m, i) => ({
        meal: meal({ id: `m${i}`, weekday: 1 }),
        baseItems: [],
        baseTotals: { ...ZERO_TOTALS, kcal: m.kcal, protein_dg: m.kcal },
        variants: [],
        log: null,
        chosenVariantId: null,
        eaten: m.eaten,
        selectionItems: [],
        selectionTotals: { ...ZERO_TOTALS, kcal: m.kcal, protein_dg: m.kcal },
      })),
    };
  }

  it("conta i pasti MANGIATI più tutti gli extra", () => {
    const extras = [
      extraView(
        {
          id: "e1",
          date: "2026-07-13",
          food_id: "f1",
          qty: 50,
          name: null,
          kcal: null,
          protein_g: null,
          carbs_g: null,
          fat_g: null,
          ...audit,
        },
        f1,
      ),
      extraView(
        {
          id: "e2",
          date: "2026-07-13",
          food_id: null,
          qty: null,
          name: "Gelato al bar",
          kcal: 320,
          protein_g: 4.5,
          carbs_g: null,
          fat_g: null,
          ...audit,
        },
        null,
      ),
    ];
    const totals = dayTotals(
      dayWith([
        { kcal: 500, eaten: true },
        { kcal: 700, eaten: false },
      ]),
      extras,
    );
    // 500 (mangiato) + 50 (mezzo f1) + 320 (voce libera); il non mangiato no.
    expect(totals.kcal).toBe(870);
    expect(totals.protein_dg).toBe(500 + 50 + 45);
  });

  it("extra con alimento perso: totals null, fuori dai conti", () => {
    const orphan = extraView(
      {
        id: "e3",
        date: "2026-07-13",
        food_id: "f-perso",
        qty: 100,
        name: null,
        kcal: null,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
        ...audit,
      },
      null,
    );
    expect(orphan.totals).toBeNull();
    expect(dayTotals(dayWith([]), [orphan]).kcal).toBe(0);
  });

  it("voce libera senza macro: kcal contate, macro a zero", () => {
    const v = extraView(
      {
        id: "e4",
        date: "2026-07-13",
        food_id: null,
        qty: null,
        name: "Caffè e brioche",
        kcal: 250,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
        ...audit,
      },
      null,
    );
    expect(v.totals).toEqual({ kcal: 250, protein_dg: 0, carbs_dg: 0, fat_dg: 0 });
  });
});

describe("remainingVsTarget", () => {
  it("kcal in kcal, proteine in decigrammi (target convertito)", () => {
    const totals: MacroTotals = {
      kcal: 1640,
      protein_dg: 920,
      carbs_dg: 0,
      fat_dg: 0,
    };
    const r = remainingVsTarget(totals, 2760, 144);
    expect(r.kcal).toEqual({ target: 2760, consumed: 1640, remaining: 1120 });
    expect(r.protein_dg).toEqual({
      target: 1440,
      consumed: 920,
      remaining: 520,
    });
  });

  it("sopra l'obiettivo il resto è negativo, onestamente", () => {
    const r = remainingVsTarget(
      { kcal: 3000, protein_dg: 0, carbs_dg: 0, fat_dg: 0 },
      2760,
      null,
    );
    expect(r.kcal?.remaining).toBe(-240);
    expect(r.protein_dg).toBeNull();
  });

  it("senza obiettivi: entrambe le righe null, mai barre inventate", () => {
    const r = remainingVsTarget(ZERO_TOTALS, null, null);
    expect(r.kcal).toBeNull();
    expect(r.protein_dg).toBeNull();
  });
});
