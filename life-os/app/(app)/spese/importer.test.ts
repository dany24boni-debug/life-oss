import { describe, expect, it } from "vitest";
import { ExpenseSchema } from "@/data/schemas";
import { buildSpeseImportPlan, type LegacyExpenseRow } from "./importer";

const pranzo: LegacyExpenseRow = {
  id: "eeee5555-0000-4000-8000-000000000001",
  expense_date: "2026-06-15",
  amount: 12.5,
  category: "cibo",
  note: "Pranzo con Anna",
  created_at: "2026-06-15T13:00:00+00:00",
  updated_at: "2026-06-16T09:00:00+00:00",
};

describe("buildSpeseImportPlan — mappatura pura personal_expenses", () => {
  it("mappa una riga legacy in una spesa valida, lossless", async () => {
    const plan = await buildSpeseImportPlan([pranzo]);
    expect(plan.skippedInvalid).toBe(0);
    const spesa = plan.expenses[0];
    expect(ExpenseSchema.parse(spesa)).toEqual(spesa);
    expect(spesa.amount).toBe(12.5);
    expect(spesa.category).toBe("cibo");
    expect(spesa.date).toBe("2026-06-15");
    expect(spesa.note).toBe("Pranzo con Anna");
    expect(spesa.created_at).toBe("2026-06-15T13:00:00.000Z");
    expect(spesa.updated_at).toBe("2026-06-16T09:00:00.000Z");
  });

  it("è deterministico e accetta numeric come STRINGA (PostgREST)", async () => {
    const stringAmount: LegacyExpenseRow = {
      ...pranzo,
      id: "eeee5555-0000-4000-8000-000000000002",
      amount: "45.90",
    };
    const a = await buildSpeseImportPlan([stringAmount]);
    const b = await buildSpeseImportPlan([stringAmount]);
    expect(a).toEqual(b);
    expect(a.expenses[0].amount).toBe(45.9);
    expect(ExpenseSchema.parse(a.expenses[0])).toEqual(a.expenses[0]);
  });

  it("scarta righe fuori dominio contandole: importo zero/negativo/testo, data rotta", async () => {
    const zero: LegacyExpenseRow = { ...pranzo, id: "x1", amount: 0 };
    const negativa: LegacyExpenseRow = { ...pranzo, id: "x2", amount: -5 };
    const testo: LegacyExpenseRow = { ...pranzo, id: "x3", amount: "boh" };
    const dataRotta: LegacyExpenseRow = {
      ...pranzo,
      id: "x4",
      expense_date: "15/06/2026",
    };
    const plan = await buildSpeseImportPlan([
      zero,
      negativa,
      testo,
      dataRotta,
      pranzo,
    ]);
    expect(plan.skippedInvalid).toBe(4);
    expect(plan.expenses).toHaveLength(1);
  });

  it("normalizza: categoria minuscola/trim, nota vuota → null, code float al centesimo", async () => {
    const sporca: LegacyExpenseRow = {
      ...pranzo,
      id: "eeee5555-0000-4000-8000-000000000003",
      category: "  Cibo ",
      note: "   ",
      amount: 12.500000001,
      updated_at: null,
    };
    const plan = await buildSpeseImportPlan([sporca]);
    const spesa = plan.expenses[0];
    expect(spesa.category).toBe("cibo");
    expect(spesa.note).toBeNull();
    expect(spesa.amount).toBe(12.5);
    expect(spesa.updated_at).toBe(spesa.created_at);
    expect(ExpenseSchema.parse(spesa)).toEqual(spesa);
  });
});
