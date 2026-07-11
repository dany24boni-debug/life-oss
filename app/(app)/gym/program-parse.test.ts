import { describe, expect, it } from "vitest";
import {
  formatRestShort,
  normalizePrescriptionInput,
  parseRestInput,
  sectionGroups,
  slotSummary,
} from "./program-parse";

describe("normalizePrescriptionInput", () => {
  it("trim, spazi collassati, trattino ASCII → trattino medio del foglio", () => {
    expect(normalizePrescriptionInput("  3-5 ")).toBe("3–5");
    expect(normalizePrescriptionInput("3 - 5")).toBe("3–5");
    expect(normalizePrescriptionInput("3–5")).toBe("3–5");
    expect(normalizePrescriptionInput("2/1/0")).toBe("2/1/0");
    expect(normalizePrescriptionInput("1")).toBe("1");
    expect(normalizePrescriptionInput("max reps")).toBe("max reps");
  });

  it("vuoto → null; oltre i 20 caratteri si tronca al dominio", () => {
    expect(normalizePrescriptionInput("")).toBeNull();
    expect(normalizePrescriptionInput("   ")).toBeNull();
    expect(normalizePrescriptionInput("x".repeat(30))).toBe("x".repeat(20));
  });
});

describe("parseRestInput", () => {
  it("secondi nudi, minuti con apostrofo, m:ss", () => {
    expect(parseRestInput("90")).toBe(90);
    expect(parseRestInput("270")).toBe(270);
    expect(parseRestInput("4'")).toBe(240);
    expect(parseRestInput("1'30")).toBe(90);
    expect(parseRestInput("1:30")).toBe(90);
    expect(parseRestInput(" 2’15 ")).toBe(135);
    expect(parseRestInput("4'30")).toBe(270);
  });

  it("clamp al dominio 0..900; vuoto e garbage → null", () => {
    expect(parseRestInput("1200")).toBe(900);
    expect(parseRestInput("")).toBeNull();
    expect(parseRestInput("abc")).toBeNull();
    expect(parseRestInput("1'75")).toBeNull(); // secondi > 59: non è un orario
  });
});

describe("formatRestShort", () => {
  it("minuti e secondi come sul foglio", () => {
    expect(formatRestShort(270)).toBe("4'30");
    expect(formatRestShort(240)).toBe("4'");
    expect(formatRestShort(75)).toBe("1'15");
    expect(formatRestShort(45)).toBe('45"');
    expect(formatRestShort(null)).toBe("—");
  });
});

describe("sectionGroups", () => {
  it("raggruppa i CONSECUTIVI, senza mai riordinare", () => {
    const slots = [
      { section: "FORZA", id: "a" },
      { section: "FORZA", id: "b" },
      { section: "IPERTROFIA", id: "c" },
      { section: null, id: "d" },
      { section: "FORZA", id: "e" }, // di nuovo FORZA: blocco NUOVO
    ];
    const groups = sectionGroups(slots);
    expect(groups.map((g) => g.section)).toEqual([
      "FORZA",
      "IPERTROFIA",
      null,
      "FORZA",
    ]);
    expect(groups[0].slots.map((s) => s.id)).toEqual(["a", "b"]);
    expect(groups[3].slots.map((s) => s.id)).toEqual(["e"]);
    expect(sectionGroups([])).toEqual([]);
  });
});

describe("slotSummary", () => {
  it("compone solo le parti presenti", () => {
    expect(
      slotSummary({
        target_sets: 4,
        target_reps: "3–5",
        target_rir: "1",
        rest_seconds: 270,
        bodyweight: false,
      }),
    ).toBe("4×3–5 · RIR 1 · rec 4'30");
    expect(
      slotSummary({
        target_sets: 3,
        target_reps: "6–10",
        target_rir: "1",
        rest_seconds: 75,
        bodyweight: true,
      }),
    ).toBe("3×6–10 · RIR 1 · rec 1'15 · corpo libero");
    expect(
      slotSummary({
        target_sets: 3,
        target_reps: null,
        target_rir: null,
        rest_seconds: null,
        bodyweight: false,
      }),
    ).toBe("3 serie");
  });
});
