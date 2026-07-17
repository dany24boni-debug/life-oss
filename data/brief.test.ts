import { describe, expect, it } from "vitest";
import {
  BriefSnapshotSchema,
  composeBrief,
  type BriefSnapshot,
} from "./brief";

/** Snapshot vuoto: la base delle fixture. */
function empty(over: Partial<BriefSnapshot> = {}): BriefSnapshot {
  return {
    date: "2026-07-13",
    plan: null,
    tasksOpen: 0,
    tasksOverdue: 0,
    gymNextUp: null,
    gymDoneToday: false,
    planSlot: null,
    dietVariant: null,
    meals: null,
    water: null,
    streak: null,
    ...over,
  };
}

describe("composeBrief — una frase, mai inventata", () => {
  it("zero dati: null, il componente non rende nulla", () => {
    expect(composeBrief(empty())).toBeNull();
  });

  it("ospite con soli task: la riga è solo dei task", () => {
    expect(composeBrief(empty({ tasksOpen: 3 }))).toBe("3 task aperti.");
    expect(composeBrief(empty({ tasksOpen: 1 }))).toBe("1 task aperto.");
  });

  it("i 'da ieri' pesano: dentro il conteggio o da soli (run-11)", () => {
    expect(composeBrief(empty({ tasksOpen: 4, tasksOverdue: 2 }))).toBe(
      "4 task aperti (2 da ieri).",
    );
    expect(composeBrief(empty({ tasksOverdue: 3 }))).toBe("3 task da ieri.");
  });

  it("giornata piena: al più QUATTRO pezzi, in ordine di priorità", () => {
    const full = empty({
      tasksOpen: 4,
      tasksOverdue: 2,
      gymNextUp: "Torso A",
      planSlot: { title: "Deep work", start_hhmm: "09:00", now: false },
      meals: { eaten: 1, total: 4 },
      water: { ml: 1400, targetMl: 2800 },
      streak: { current: 12, todayCounts: false },
    });
    expect(composeBrief(full)).toBe(
      "Palestra: Torso A, 4 task aperti (2 da ieri), alle 09:00 Deep work, 1/4 pasti.",
    );
  });

  it("rituale girato: la frase si apre col piano (run-11 P5c)", () => {
    expect(
      composeBrief(
        empty({
          plan: { tasks: 5, estimatedLabel: "3h30", over: false },
          gymNextUp: "Torso A",
          tasksOpen: 5,
        }),
      ),
    ).toBe("Giornata pianificata: 5 task (~3h30), palestra: Torso A, 5 task aperti.");
    expect(
      composeBrief(empty({ plan: { tasks: 0, estimatedLabel: null, over: false } })),
    ).toBe("Giornata pianificata.");
    expect(
      composeBrief(empty({ plan: { tasks: 6, estimatedLabel: "5h30", over: true } })),
    ).toBe("Giornata piena: 6 task (~5h30).");
  });

  it("variante dieta del giorno di allenamento (run-11 P5c)", () => {
    expect(
      composeBrief(
        empty({
          gymNextUp: "Gambe",
          dietVariant: "Allenamento",
          meals: { eaten: 0, total: 4 },
        }),
      ),
    ).toBe("Palestra: Gambe, variante Allenamento, 0/4 pasti.");
  });

  it("palestra fatta e slot in corso cambiano forma", () => {
    expect(
      composeBrief(
        empty({
          gymDoneToday: true,
          planSlot: { title: "Deep work", start_hhmm: "09:00", now: true },
        }),
      ),
    ).toBe("Palestra già fatta, adesso Deep work.");
  });

  it("pasti completi, acqua e streak: le code quiete", () => {
    expect(
      composeBrief(
        empty({
          meals: { eaten: 4, total: 4 },
          water: { ml: 2900, targetMl: 2800 },
          streak: { current: 5, todayCounts: true },
        }),
      ),
    ).toBe("Pasti tutti fatti, acqua fatta, streak a 5 (oggi conta già).");
    expect(
      composeBrief(empty({ water: { ml: 830, targetMl: 2800 } })),
    ).toBe("Acqua al 30%.");
  });

  it("omissioni oneste: acqua a zero e streak a zero non compaiono", () => {
    expect(
      composeBrief(
        empty({
          water: { ml: 0, targetMl: 2800 },
          streak: { current: 0, todayCounts: false },
          meals: { eaten: 0, total: 0 },
        }),
      ),
    ).toBeNull();
  });

  it("lo schema dello snapshot valida il payload del client", () => {
    expect(BriefSnapshotSchema.safeParse(empty()).success).toBe(true);
    expect(
      BriefSnapshotSchema.safeParse({ ...empty(), tasksOpen: -1 }).success,
    ).toBe(false);
    expect(
      BriefSnapshotSchema.safeParse({
        ...empty(),
        planSlot: { title: "", start_hhmm: "09:00", now: false },
      }).success,
    ).toBe(false);
  });
});
