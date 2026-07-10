import { describe, expect, it } from "vitest";
import {
  bestDay,
  completionPercent,
  fillDays,
  lastSevenDays,
  monthBounds,
  weekBounds,
  weeklyObservation,
  type DayCompletion,
} from "./logic";

const d = (date: string, total: number, done: number): DayCompletion => ({
  date,
  total,
  done,
});

describe("range", () => {
  it("weekBounds: lun-dom della settimana (2026-07-10 è venerdì)", () => {
    expect(weekBounds("2026-07-10")).toEqual({
      from: "2026-07-06",
      to: "2026-07-12",
    });
    expect(weekBounds("2026-07-06")).toEqual({
      from: "2026-07-06",
      to: "2026-07-12",
    });
  });

  it("lastSevenDays include oggi e i 6 precedenti", () => {
    expect(lastSevenDays("2026-07-10")).toEqual({
      from: "2026-07-04",
      to: "2026-07-10",
    });
  });

  it("monthBounds gestisce mesi corti, lunghi e febbraio bisestile", () => {
    expect(monthBounds("2026-07-10")).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
    });
    expect(monthBounds("2026-02-15")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(monthBounds("2028-02-01")).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
    expect(monthBounds("2026-12-31")).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
    });
  });
});

describe("fillDays / completionPercent / bestDay", () => {
  it("fillDays riempie i buchi con zeri mantenendo l'ordine", () => {
    const filled = fillDays(
      [d("2026-07-07", 3, 2)],
      "2026-07-06",
      "2026-07-08",
    );
    expect(filled).toEqual([
      d("2026-07-06", 0, 0),
      d("2026-07-07", 3, 2),
      d("2026-07-08", 0, 0),
    ]);
  });

  it("completionPercent: percentuale onesta, null su zero task", () => {
    expect(completionPercent([d("a", 4, 3), d("b", 4, 1)])).toBe(50);
    expect(completionPercent([d("a", 0, 0)])).toBeNull();
    expect(completionPercent([])).toBeNull();
  });

  it("bestDay: il giorno con più chiusi, null se tutto a zero", () => {
    expect(bestDay([d("a", 5, 1), d("b", 5, 4), d("c", 5, 2)])?.date).toBe("b");
    expect(bestDay([d("a", 3, 0)])).toBeNull();
  });
});

describe("weeklyObservation — una frase, mai shame", () => {
  const week = (dones: number[]) =>
    dones.map((done, i) => d(`2026-07-0${i + 4}`, Math.max(done, 3), done));

  it("settimana a zero: ripartenza gentile", () => {
    const s = weeklyObservation(week([0, 0, 0, 0, 0, 0, 0]));
    expect(s).toContain("ripartenza");
  });

  it("attivo ogni giorno: costanza", () => {
    const s = weeklyObservation(week([1, 2, 1, 1, 3, 1, 2]));
    expect(s).toContain("costanza");
  });

  it("completamento alto: riconosce la pianificazione", () => {
    const days = [d("a", 5, 5), d("b", 5, 4), d("c", 0, 0)];
    const s = weeklyObservation(days);
    expect(s).toContain("90%");
  });

  it("un giorno traina la settimana", () => {
    const days = week([0, 6, 0, 1, 1, 0, 0]);
    expect(weeklyObservation(days)).toContain("traino");
  });

  it("fallback: conteggio piano, singolare curato", () => {
    expect(weeklyObservation(week([0, 1, 0, 0, 0, 0, 0]))).toContain(
      "Un task chiuso",
    );
    // Tre giorni da 1: nessun giorno "traina" (1*2 < 3), niente 80%.
    expect(weeklyObservation(week([1, 1, 1, 0, 0, 0, 0]))).toContain(
      "3 task chiusi",
    );
  });

  it("nessuna parola di shame in nessun ramo", () => {
    const branches = [
      week([0, 0, 0, 0, 0, 0, 0]),
      week([1, 1, 1, 1, 1, 1, 1]),
      [d("a", 5, 5), d("b", 5, 4)],
      week([0, 6, 0, 1, 1, 0, 0]),
      week([0, 2, 0, 0, 1, 0, 0]),
    ];
    for (const days of branches) {
      const s = weeklyObservation(days).toLowerCase();
      for (const bad of ["solo ", "male", "peggio", "fallito", "dovevi", "in ritardo"]) {
        expect(s).not.toContain(bad);
      }
    }
  });
});
