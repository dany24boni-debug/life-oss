import { describe, expect, it } from "vitest";
import type { Food, MealItem } from "@/data/schemas";
import {
  barTone,
  cycleSelection,
  defaultQtyFor,
  formatGramsFromDg,
  formatInt,
  formatQty,
  kcalProteinLine,
  parseKcalInput,
  parseMacroInput,
  parseQtyInput,
  qtyStep,
  sumItemTotals,
} from "./logic";

describe("formattazione it-IT (grouping sempre attivo)", () => {
  it("formatInt raggruppa anche sotto 10.000 — la landmine nota", () => {
    expect(formatInt(1640)).toBe("1.640");
    expect(formatInt(447)).toBe("447");
  });

  it("formatGramsFromDg: decigrammi → grammi con un decimale", () => {
    expect(formatGramsFromDg(925)).toBe("92,5");
    expect(formatGramsFromDg(1440)).toBe("144");
    expect(formatGramsFromDg(0)).toBe("0");
  });

  it("kcalProteinLine e formatQty", () => {
    expect(
      kcalProteinLine({ kcal: 447, protein_dg: 453, carbs_dg: 0, fat_dg: 0 }),
    ).toBe("447 kcal · 45,3 g proteine");
    expect(formatQty(80, "per100g")).toBe("80 g");
    expect(formatQty(1.5, "per_piece")).toBe("1,5 pz");
  });
});

describe("cycleSelection — base → varianti → base", () => {
  it("cicla in ordine e torna alla base dopo l'ultima", () => {
    expect(cycleSelection(null, ["b"])).toBe("b");
    expect(cycleSelection("b", ["b"])).toBeNull();
    expect(cycleSelection(null, ["b", "c"])).toBe("b");
    expect(cycleSelection("b", ["b", "c"])).toBe("c");
    expect(cycleSelection("c", ["b", "c"])).toBeNull();
  });

  it("senza varianti resta base; scelta ignota riparte dalla base", () => {
    expect(cycleSelection(null, [])).toBeNull();
    expect(cycleSelection("morta", ["b"])).toBeNull();
  });
});

describe("barTone — segnale solo oltre il +10%", () => {
  it("sotto e fino al +10% resta il tono suo", () => {
    expect(barTone("ember", 2000, 2760)).toBe("ember");
    expect(barTone("salvia", 144, 144)).toBe("salvia");
    expect(barTone("ember", 3036, 2760)).toBe("ember"); // esattamente +10%
  });

  it("oltre il +10% diventa segnale", () => {
    expect(barTone("ember", 3037, 2760)).toBe("segnale");
    expect(barTone("salvia", 160, 144)).toBe("segnale");
  });
});

describe("parse degli input", () => {
  it("parseQtyInput: virgola o punto, un decimale, mai zero o garbage", () => {
    expect(parseQtyInput("80")).toBe(80);
    expect(parseQtyInput("1,5")).toBe(1.5);
    expect(parseQtyInput("62.55")).toBe(62.6); // arrotonda a un decimale
    expect(parseQtyInput("0")).toBeNull();
    expect(parseQtyInput("-5")).toBeNull();
    expect(parseQtyInput("abc")).toBeNull();
    expect(parseQtyInput("10001")).toBeNull();
  });

  it("parseKcalInput: solo intere 0..9000", () => {
    expect(parseKcalInput("353")).toBe(353);
    expect(parseKcalInput("0")).toBe(0);
    expect(parseKcalInput("353,4")).toBeNull();
    expect(parseKcalInput("9001")).toBeNull();
  });

  it("parseMacroInput: grammi 0..1000 a un decimale; vuoto → null", () => {
    expect(parseMacroInput("13,5")).toBe(13.5);
    expect(parseMacroInput("0")).toBe(0);
    expect(parseMacroInput("")).toBeNull();
    expect(parseMacroInput("1001")).toBeNull();
  });
});

describe("stepper e somme di authoring", () => {
  const T0 = "2026-07-01T08:00:00.000Z";
  const audit = { created_at: T0, updated_at: T0, deleted_at: null };
  const pasta: Food = {
    id: "f1",
    name: "Pasta",
    basis: "per100g",
    kcal: 353,
    protein_g: 13.5,
    carbs_g: 70.2,
    fat_g: 1.8,
    default_qty: 80,
    archived_at: null,
    ...audit,
  };
  const uovo: Food = {
    ...pasta,
    id: "f2",
    name: "Uovo",
    basis: "per_piece",
    kcal: 78,
    protein_g: 6.3,
    default_qty: null,
  };

  it("qtyStep e defaultQtyFor seguono la basis", () => {
    expect(qtyStep("per100g")).toBe(10);
    expect(qtyStep("per_piece")).toBe(1);
    expect(defaultQtyFor(pasta)).toBe(80);
    expect(defaultQtyFor(uovo)).toBe(1);
    expect(defaultQtyFor({ basis: "per100g", default_qty: null })).toBe(100);
  });

  it("sumItemTotals somma le righe risolvibili e salta le perse", () => {
    const items: MealItem[] = [
      {
        id: "i1",
        meal_id: "m1",
        variant_id: null,
        food_id: "f1",
        qty: 80,
        sort_order: 0,
        ...audit,
      },
      {
        id: "i2",
        meal_id: "m1",
        variant_id: null,
        food_id: "f-perso",
        qty: 100,
        sort_order: 1,
        ...audit,
      },
      {
        id: "i3",
        meal_id: "m1",
        variant_id: null,
        food_id: "f2",
        qty: 2,
        sort_order: 2,
        ...audit,
      },
    ];
    const foodById = new Map([
      ["f1", pasta],
      ["f2", uovo],
    ]);
    const totals = sumItemTotals(items, foodById);
    expect(totals.kcal).toBe(282 + 156); // pasta 80 g + 2 uova; la persa non conta
    expect(totals.protein_dg).toBe(108 + 126);
  });
});
