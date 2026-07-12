import { describe, expect, it } from "vitest";
import type { HabitBoardEntry } from "@/data/ports";
import type { Habit } from "@/data/schemas";
import { WATER_HABIT_ID } from "@/data/habits";
import {
  canEditDay,
  defaultQuickStep,
  formatHabitValue,
  formatValueLine,
  parseValueInput,
  quickSteps,
  ringProgress,
  waterFirst,
} from "./logic";

describe("ringProgress", () => {
  it("frazione clampata 0..1; senza obiettivo pieno solo con valore", () => {
    expect(ringProgress(0, 2800)).toBe(0);
    expect(ringProgress(1400, 2800)).toBe(0.5);
    expect(ringProgress(5000, 2800)).toBe(1);
    expect(ringProgress(0, null)).toBe(0);
    expect(ringProgress(3, null)).toBe(1);
  });
});

describe("quickSteps", () => {
  it("acqua: i gesti reali", () => {
    expect(quickSteps("ml", 2800)).toEqual([200, 330, 500]);
    expect(quickSteps("ml", null)).toEqual([200, 330, 500]);
  });

  it("con obiettivo: passi parlanti derivati, dedupe, mai zero", () => {
    expect(quickSteps("pagine", 10)).toEqual([1, 2, 5]);
    expect(quickSteps(null, 30)).toEqual([2, 10, 20]); // 3→2, 7.5→10, 15→20 (nice)
    expect(quickSteps("min", 100)).toEqual([10, 20, 50]);
  });

  it("senza obiettivo: 1 / 5 / 10", () => {
    expect(quickSteps("pagine", null)).toEqual([1, 5, 10]);
  });

  it("il passo one-thumb è il chip di mezzo", () => {
    expect(defaultQuickStep("ml", null)).toBe(330);
    expect(defaultQuickStep("pagine", null)).toBe(5);
    expect(defaultQuickStep(null, null)).toBe(5);
  });
});

describe("formattazione it-IT", () => {
  it("raggruppamento SEMPRE: 2.800 anche sotto 10.000 (landmine nota)", () => {
    expect(formatHabitValue(2800)).toBe("2.800");
    expect(formatHabitValue(830)).toBe("830");
    expect(formatHabitValue(1.5)).toBe("1,5");
  });

  it("riga valore: con e senza obiettivo/unità", () => {
    expect(formatValueLine(830, 2800, "ml")).toBe("830 / 2.800 ml");
    expect(formatValueLine(3, 5, null)).toBe("3 / 5");
    expect(formatValueLine(12, null, "pagine")).toBe("12 pagine");
  });
});

describe("parseValueInput", () => {
  it("accetta interi e decimali con virgola o punto", () => {
    expect(parseValueInput("250")).toBe(250);
    expect(parseValueInput(" 1,5 ")).toBe(1.5);
    expect(parseValueInput("2.5")).toBe(2.5);
  });

  it("rifiuta vuoto, negativi, spazzatura e fuori dominio", () => {
    expect(parseValueInput("")).toBeNull();
    expect(parseValueInput("-3")).toBeNull();
    expect(parseValueInput("abc")).toBeNull();
    expect(parseValueInput("1e9")).toBeNull();
    expect(parseValueInput("2000001")).toBeNull();
  });
});

describe("waterFirst / canEditDay", () => {
  function entry(id: string, sortOrder: number): HabitBoardEntry {
    const habit = { id, sort_order: sortOrder } as Habit;
    return { habit, log: null, target: null, value: 0, done: false };
  }

  it("l'acqua sale in testa, il resto per sort_order", () => {
    const sorted = waterFirst([
      entry("b", 1),
      entry(WATER_HABIT_ID, 5),
      entry("a", 0),
    ]);
    expect(sorted.map((e) => e.habit.id)).toEqual([WATER_HABIT_ID, "a", "b"]);
  });

  it("si scrive oggi e ieri, mai domani", () => {
    expect(canEditDay("2026-07-12", "2026-07-12")).toBe(true);
    expect(canEditDay("2026-07-11", "2026-07-12")).toBe(true);
    expect(canEditDay("2026-07-13", "2026-07-12")).toBe(false);
  });
});
