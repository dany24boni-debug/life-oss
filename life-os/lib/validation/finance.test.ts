import { describe, expect, it } from "vitest";
import {
  AddExpenseSchema,
  ExpenseIdSchema,
  UpdateExpenseSchema,
} from "./finance";

describe("AddExpenseSchema", () => {
  it("happy path: well-formed FormData object", () => {
    const r = AddExpenseSchema.safeParse({
      expense_date: "2026-05-14",
      amount: "12.50",
      category: "cibo",
      note: "Esselunga",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({
        expense_date: "2026-05-14",
        amount: 12.5,
        category: "cibo",
        note: "Esselunga",
      });
    }
  });

  it("coerces integer amount from string", () => {
    const r = AddExpenseSchema.safeParse({
      expense_date: "2026-05-14",
      amount: "100",
      category: "casa",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amount).toBe(100);
  });

  it("accepts missing note (omitted from FormData)", () => {
    const r = AddExpenseSchema.safeParse({
      expense_date: "2026-05-14",
      amount: "5.00",
      category: "trasporto",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.note).toBeNull();
  });

  it("collapses empty-string note to null", () => {
    const r = AddExpenseSchema.safeParse({
      expense_date: "2026-05-14",
      amount: "5.00",
      category: "trasporto",
      note: "",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.note).toBeNull();
  });

  it("rejects zero amount (gt 0)", () => {
    const r = AddExpenseSchema.safeParse({
      expense_date: "2026-05-14",
      amount: "0",
      category: "altro",
    });
    expect(r.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const r = AddExpenseSchema.safeParse({
      expense_date: "2026-05-14",
      amount: "-5.50",
      category: "altro",
    });
    expect(r.success).toBe(false);
  });

  it("rejects amount above 99999999.99", () => {
    const r = AddExpenseSchema.safeParse({
      expense_date: "2026-05-14",
      amount: "100000000",
      category: "altro",
    });
    expect(r.success).toBe(false);
  });

  it("accepts the exact upper bound 99999999.99", () => {
    const r = AddExpenseSchema.safeParse({
      expense_date: "2026-05-14",
      amount: "99999999.99",
      category: "altro",
    });
    expect(r.success).toBe(true);
  });

  it("rejects more than 2 decimal places (no silent DB truncation)", () => {
    // ECC mid-sprint U2 HIGH-1 close: Postgres numeric(10,2)
    // troncherebbe "12.999" a 13.00. La refine rifiuta lato
    // schema cosi' il form puo' mostrare un errore esplicito.
    const r = AddExpenseSchema.safeParse({
      expense_date: "2026-05-14",
      amount: "12.999",
      category: "cibo",
    });
    expect(r.success).toBe(false);
  });

  it("accepts exactly 2 decimals (e.g. 12.50)", () => {
    const r = AddExpenseSchema.safeParse({
      expense_date: "2026-05-14",
      amount: "12.50",
      category: "cibo",
    });
    expect(r.success).toBe(true);
  });

  it("accepts integer amount without decimals (e.g. 12)", () => {
    const r = AddExpenseSchema.safeParse({
      expense_date: "2026-05-14",
      amount: "12",
      category: "cibo",
    });
    expect(r.success).toBe(true);
  });

  it("rejects non-numeric amount string", () => {
    const r = AddExpenseSchema.safeParse({
      expense_date: "2026-05-14",
      amount: "tanti",
      category: "altro",
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown category", () => {
    const r = AddExpenseSchema.safeParse({
      expense_date: "2026-05-14",
      amount: "5",
      category: "miscellanea", // not in CATEGORIES tuple
    });
    expect(r.success).toBe(false);
  });

  it("rejects missing category (required, no default)", () => {
    const r = AddExpenseSchema.safeParse({
      expense_date: "2026-05-14",
      amount: "5",
    });
    expect(r.success).toBe(false);
  });

  it("rejects calendar-impossible date (z.iso.date)", () => {
    const r = AddExpenseSchema.safeParse({
      expense_date: "2026-02-30",
      amount: "5",
      category: "altro",
    });
    expect(r.success).toBe(false);
  });

  it("rejects malformed-shape date", () => {
    const r = AddExpenseSchema.safeParse({
      expense_date: "14/05/2026",
      amount: "5",
      category: "altro",
    });
    expect(r.success).toBe(false);
  });

  it("caps note at 280 chars via trim helper", () => {
    const longNote = "x".repeat(500);
    const r = AddExpenseSchema.safeParse({
      expense_date: "2026-05-14",
      amount: "5",
      category: "altro",
      note: longNote,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.note?.length).toBe(280);
  });

  it("accepts all 10 categories", () => {
    for (const c of [
      "cibo",
      "trasporto",
      "svago",
      "vestiti",
      "casa",
      "salute",
      "studio",
      "tech",
      "regalo",
      "altro",
    ] as const) {
      const r = AddExpenseSchema.safeParse({
        expense_date: "2026-05-14",
        amount: "1",
        category: c,
      });
      expect(r.success, `category ${c} should be accepted`).toBe(true);
    }
  });
});

describe("UpdateExpenseSchema", () => {
  it("happy path with UUID + all fields", () => {
    const r = UpdateExpenseSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000001",
      expense_date: "2026-05-14",
      amount: "42.00",
      category: "regalo",
      note: "compleanno",
    });
    expect(r.success).toBe(true);
  });

  it("rejects malformed UUID", () => {
    const r = UpdateExpenseSchema.safeParse({
      id: "not-a-uuid",
      expense_date: "2026-05-14",
      amount: "42.00",
      category: "regalo",
    });
    expect(r.success).toBe(false);
  });
});

describe("ExpenseIdSchema", () => {
  it("accepts valid UUID", () => {
    expect(
      ExpenseIdSchema.safeParse({
        id: "00000000-0000-0000-0000-000000000001",
      }).success,
    ).toBe(true);
  });

  it("rejects missing id", () => {
    expect(ExpenseIdSchema.safeParse({}).success).toBe(false);
  });

  it("rejects empty id", () => {
    expect(ExpenseIdSchema.safeParse({ id: "" }).success).toBe(false);
  });
});
