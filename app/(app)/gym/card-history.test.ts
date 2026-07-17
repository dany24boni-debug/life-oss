import { describe, expect, it } from "vitest";
import type { GymSet } from "@/data/schemas";
import {
  gymCardHref,
  historyColumns,
  lastDoneDate,
  sectionSummary,
  setsBySessionForExercise,
} from "./card-history";

/* ── Fixture: sedute di un giorno-scheda, più-recenti-prima come le
      restituisce listSessionsByProgramDay ─────────────────────────── */

const TODAY = "2026-07-17";

const sessions = [
  // Oggi, in corso: colonna viva.
  { id: "s-today", date: TODAY, finished_at: null },
  // Conclusa lunedì.
  { id: "s-15", date: "2026-07-15", finished_at: "2026-07-15T18:00:00.000Z" },
  // ABBANDONATA (mai conclusa, giorno passato): non è storia.
  { id: "s-13", date: "2026-07-13", finished_at: null },
  // Conclusa la settimana prima.
  { id: "s-10", date: "2026-07-10", finished_at: "2026-07-10T18:10:00.000Z" },
];

describe("historyColumns", () => {
  it("tiene le concluse più la seduta di oggi anche se in corso; le abbandonate restano fuori", () => {
    const cols = historyColumns(sessions, TODAY);
    expect(cols.map((c) => c.sessionId)).toEqual(["s-today", "s-15", "s-10"]);
    expect(cols[0].isToday).toBe(true);
    expect(cols[1]).toEqual({
      sessionId: "s-15",
      date: "2026-07-15",
      isToday: false,
    });
  });

  it("rispetta il tetto di colonne mantenendo le più recenti", () => {
    const cols = historyColumns(sessions, TODAY, 2);
    expect(cols.map((c) => c.sessionId)).toEqual(["s-today", "s-15"]);
  });

  it("senza sedute non inventa colonne", () => {
    expect(historyColumns([], TODAY)).toEqual([]);
  });
});

describe("lastDoneDate", () => {
  it("è il giorno dell'ultima seduta CONCLUSA (quella in corso non conta)", () => {
    expect(lastDoneDate(sessions)).toBe("2026-07-15");
  });

  it("null senza storia conclusa", () => {
    expect(lastDoneDate([{ date: TODAY, finished_at: null }])).toBeNull();
    expect(lastDoneDate([])).toBeNull();
  });
});

describe("sectionSummary", () => {
  it("conta i gruppi consecutivi della scheda (la forma Torso A)", () => {
    const slots = [
      { section: "FORZA" },
      { section: "FORZA" },
      { section: "FORZA" },
      { section: "IPERTROFIA" },
      { section: "IPERTROFIA" },
      { section: "IPERTROFIA" },
      { section: "CORE" },
    ];
    expect(sectionSummary(slots)).toBe("3 FORZA · 3 IPERTROFIA · 1 CORE");
  });

  it("una scheda senza sezioni si riassume in esercizi", () => {
    expect(sectionSummary([{ section: null }, { section: null }])).toBe(
      "2 esercizi",
    );
    expect(sectionSummary([{ section: null }])).toBe("1 esercizio");
  });

  it("i gruppi senza sezione in mezzo restano onesti e l'ordine non si riordina mai", () => {
    const slots = [
      { section: "FORZA" },
      { section: null },
      { section: "FORZA" },
    ];
    expect(sectionSummary(slots)).toBe("1 FORZA · 1 esercizio · 1 FORZA");
  });

  it("scheda vuota", () => {
    expect(sectionSummary([])).toBe("Vuota");
  });
});

describe("setsBySessionForExercise", () => {
  const set = (
    id: string,
    session_id: string,
    set_number: number,
  ): GymSet =>
    ({
      id,
      session_id,
      exercise_id: "ex-1",
      set_number,
      weight_kg: 60,
      reps: 8,
      rir_done: null,
      rest_actual_s: null,
      feeling_1_10: null,
      done_at: null,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
      deleted_at: null,
    }) as GymSet;

  it("bucketizza per sessione, ordina per set_number e ignora sessioni fuori colonna", () => {
    const cols = historyColumns(sessions, TODAY);
    const bySession = setsBySessionForExercise(
      [
        set("a", "s-15", 2),
        set("b", "s-15", 1),
        set("c", "s-10", 1),
        set("d", "s-13", 1), // abbandonata: fuori dalle colonne
        set("e", "altra-sessione", 1),
      ],
      cols,
    );
    expect(bySession.get("s-15")?.map((s) => s.id)).toEqual(["b", "a"]);
    expect(bySession.get("s-10")?.map((s) => s.id)).toEqual(["c"]);
    expect(bySession.has("s-13")).toBe(false);
    expect(bySession.has("altra-sessione")).toBe(false);
  });
});

describe("gymCardHref", () => {
  it("è la rotta della card (il bersaglio del tile di Oggi)", () => {
    expect(gymCardHref("day-1")).toBe("/gym?scheda=day-1");
  });
});
