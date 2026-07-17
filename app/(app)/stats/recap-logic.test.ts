import { describe, expect, it } from "vitest";
import { deltaPct, monthLabel, monthShift } from "./recap-logic";

describe("monthShift e monthLabel (run-12, Il tuo mese)", () => {
  it("offset 0 = mese corrente; negativi attraversano l'anno", () => {
    expect(monthShift("2026-07-17", 0)).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
    });
    expect(monthShift("2026-07-17", -1)).toEqual({
      from: "2026-06-01",
      to: "2026-06-30",
    });
    expect(monthShift("2026-02-10", -2)).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
    // Febbraio bisestile.
    expect(monthShift("2028-03-15", -1)).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
  });

  it("etichetta it-IT del mese", () => {
    expect(monthLabel("2026-07-01")).toBe("luglio 2026");
    expect(monthLabel("2025-12-01")).toBe("dicembre 2025");
  });
});

describe("deltaPct (run-12, PROP-stats-01)", () => {
  it("segno, tono e il caso zero-confronto", () => {
    expect(deltaPct(9, 8)).toEqual({ value: "+13%", tone: "up" });
    expect(deltaPct(6, 8)).toEqual({ value: "-25%", tone: "down" });
    expect(deltaPct(8, 8)).toEqual({ value: "0%", tone: "flat" });
    expect(deltaPct(0, 8)).toEqual({ value: "-100%", tone: "down" });
    expect(deltaPct(5, 0)).toBeUndefined();
  });
});
