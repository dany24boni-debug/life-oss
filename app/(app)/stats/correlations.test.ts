import { describe, expect, it } from "vitest";
import {
  correlationWindow,
  dietWeightLine,
  energyTasksLine,
  focusTasksLine,
  splitComparison,
  trainingHabitsLine,
} from "./correlations";

describe("splitComparison", () => {
  it("medie per gruppo e differenza; sotto la soglia per gruppo → null", () => {
    const five = (inA: boolean, value: number) =>
      Array.from({ length: 5 }, () => ({ inA, value }));
    const c = splitComparison([...five(true, 4), ...five(false, 2)]);
    expect(c).toEqual({
      n: 10,
      nA: 5,
      nB: 5,
      meanA: 4,
      meanB: 2,
      diff: 2,
    });
    expect(splitComparison([...five(true, 4), ...five(false, 2).slice(1)])).toBeNull();
    expect(splitComparison([])).toBeNull();
  });
});

describe("correlationWindow", () => {
  it("60 giorni conclusi, oggi escluso", () => {
    expect(correlationWindow("2026-07-17")).toEqual({
      from: "2026-05-18",
      to: "2026-07-16",
    });
  });
});

describe("trainingHabitsLine", () => {
  const days = (
    n: number,
    startDay: number,
    done: number,
    scheduled: number,
  ) =>
    Array.from({ length: n }, (_, i) => ({
      date: `2026-06-${String(startDay + i).padStart(2, "0")}`,
      scheduled,
      done,
    }));

  it("la frase dice direzione, punti percentuali e la n", () => {
    // 5 giorni allenati all'80%, 5 non allenati al 50% → +30%.
    const habitDays = [...days(5, 1, 4, 5), ...days(5, 10, 2, 4)];
    const trained = new Set(habitDays.slice(0, 5).map((d) => d.date));
    const r = trainingHabitsLine(habitDays, trained);
    expect(r?.line).toBe(
      "Nei giorni di allenamento completi il 30% di abitudini in più — su 10 giorni.",
    );
  });

  it("differenza sotto l'1%: frase onesta di parità", () => {
    const habitDays = [...days(5, 1, 3, 5), ...days(5, 10, 3, 5)];
    const trained = new Set(habitDays.slice(0, 5).map((d) => d.date));
    expect(trainingHabitsLine(habitDays, trained)?.line).toBe(
      "Con o senza allenamento le abitudini vanno uguali — su 10 giorni.",
    );
  });

  it("pochi dati → null", () => {
    const habitDays = days(6, 1, 3, 5);
    expect(trainingHabitsLine(habitDays, new Set([habitDays[0].date]))).toBeNull();
  });
});

describe("focusTasksLine", () => {
  it("giorni senza task contano come zero; medie a una decimale it-IT", () => {
    const days = Array.from(
      { length: 10 },
      (_, i) => `2026-06-${String(i + 1).padStart(2, "0")}`,
    );
    const focus = new Map(days.slice(0, 5).map((d) => [d, 25] as const));
    const done = new Map<string, number>([
      [days[0], 3],
      [days[1], 2],
      // giorni 2-4 con focus ma zero task chiusi
      [days[5], 1],
    ]);
    const r = focusTasksLine(days, done, focus);
    // Con focus: (3+2+0+0+0)/5 = 1; senza: (1+0+0+0+0)/5 = 0,2.
    expect(r?.line).toBe(
      "Nei giorni con almeno un focus chiudi in media 1 task, senza 0,2 — su 10 giorni.",
    );
  });
});

describe("energyTasksLine", () => {
  it("split 4–5 contro il resto, unità 'serate'", () => {
    const mk = (i: number, energy: number) => ({
      date: `2026-06-${String(i).padStart(2, "0")}`,
      energy,
    });
    const checkins = [
      ...Array.from({ length: 5 }, (_, i) => mk(i + 1, 5)),
      ...Array.from({ length: 5 }, (_, i) => mk(i + 10, 2)),
    ];
    const done = new Map(
      checkins.map((c) => [c.date, c.energy >= 4 ? 4 : 1] as const),
    );
    expect(energyTasksLine(checkins, done)?.line).toBe(
      "Nelle giornate chiuse con energia alta (4–5) hai fatto in media 4 task, nelle altre 1 — su 10 serate.",
    );
  });
});

describe("dietWeightLine", () => {
  it("settimane qualificate (≥4 giorni loggati, ≥2 pesate), gruppi da 3", () => {
    const consumed: Array<{ date: string; kcal: number }> = [];
    const weights: Array<{ date: string; weight_kg: number }> = [];
    // 6 settimane ISO piene: lunedì 2026-05-04 + 7k. Le prime 3 aderenti
    // (2000 kcal sul target 2000), le altre 3 no (2600). Peso: −0,2/sett
    // nelle aderenti, +0,1 nelle altre.
    for (let w = 0; w < 6; w++) {
      const monday = new Date(`2026-05-04T12:00:00.000Z`);
      monday.setUTCDate(monday.getUTCDate() + w * 7);
      const day = (offset: number) => {
        const d = new Date(monday);
        d.setUTCDate(d.getUTCDate() + offset);
        return d.toISOString().slice(0, 10);
      };
      const adherent = w < 3;
      for (let i = 0; i < 4; i++) {
        consumed.push({ date: day(i), kcal: adherent ? 2000 : 2600 });
      }
      weights.push({ date: day(0), weight_kg: 80 });
      weights.push({
        date: day(6),
        weight_kg: adherent ? 79.8 : 80.1,
      });
    }
    const r = dietWeightLine(consumed, weights, 2000);
    expect(r?.n).toBe(6);
    expect(r?.line).toContain("-0,2 kg");
    expect(r?.line).toContain("+0,1");
    expect(r?.line).toContain("su 6 settimane");
  });

  it("senza target o senza settimane qualificate → null", () => {
    expect(dietWeightLine([], [], null)).toBeNull();
    expect(
      dietWeightLine(
        [{ date: "2026-06-01", kcal: 2000 }],
        [{ date: "2026-06-01", weight_kg: 80 }],
        2000,
      ),
    ).toBeNull();
  });
});
