import { describe, expect, it } from "vitest";
import type { Expense } from "@/data/schemas";
import {
  formatCents,
  formatEuro,
  monthBreakdown,
  monthOf,
  parseEuroAmount,
  shiftMonth,
  toCents,
} from "./logic";

function expense(amount: number, category: string): Expense {
  return {
    id: "01980000-0000-7000-8000-000000000001",
    amount,
    category,
    date: "2026-07-10",
    note: null,
    created_at: "2026-07-10T08:00:00.000Z",
    updated_at: "2026-07-10T08:00:00.000Z",
    deleted_at: null,
  };
}

describe("parseEuroAmount — input all'italiana", () => {
  it("accetta virgola, punto e interi", () => {
    expect(parseEuroAmount("12,50")).toBe(12.5);
    expect(parseEuroAmount("12.50")).toBe(12.5);
    expect(parseEuroAmount("12")).toBe(12);
    expect(parseEuroAmount(" 8,5 ")).toBe(8.5);
  });

  it("rifiuta vuoto, zero, negativi, tre decimali, testo, separatori doppi", () => {
    expect(parseEuroAmount("")).toBeNull();
    expect(parseEuroAmount("0")).toBeNull();
    expect(parseEuroAmount("-5")).toBeNull();
    expect(parseEuroAmount("1,999")).toBeNull();
    expect(parseEuroAmount("dodici")).toBeNull();
    expect(parseEuroAmount("1.234,56")).toBeNull(); // migliaia: fuori formato
  });
});

describe("aggregati in centesimi", () => {
  it("somma senza derive float: 0,10 + 0,20 = 30 centesimi esatti", () => {
    const b = monthBreakdown([expense(0.1, "cibo"), expense(0.2, "cibo")]);
    expect(b.totalCents).toBe(30);
    expect(toCents(0.1) + toCents(0.2)).toBe(30);
  });

  it("fette per categoria ordinate per spesa decrescente con quota", () => {
    const b = monthBreakdown([
      expense(10, "cibo"),
      expense(30, "trasporto"),
      expense(10, "cibo"),
    ]);
    expect(b.totalCents).toBe(5000);
    expect(b.count).toBe(3);
    expect(b.slices.map((s) => s.category)).toEqual(["trasporto", "cibo"]);
    expect(b.slices[0].pct).toBe(60);
    expect(b.slices[1].pct).toBe(40);
  });

  it("mese vuoto: zero totale, zero fette, mai divisioni per zero", () => {
    const b = monthBreakdown([]);
    expect(b.totalCents).toBe(0);
    expect(b.slices).toEqual([]);
  });
});

describe("mesi e formati", () => {
  it("monthOf / shiftMonth attraversano gli anni", () => {
    expect(monthOf("2026-07-15")).toBe("2026-07");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("formatta euro all'italiana", () => {
    // NBSP tra numero e simbolo: confrontiamo senza spazi.
    expect(formatEuro(1250.5).replace(/\s/g, "")).toBe("1.250,50€");
    expect(formatCents(30).replace(/\s/g, "")).toBe("0,30€");
  });
});
