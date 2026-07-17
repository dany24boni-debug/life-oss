import { describe, expect, it } from "vitest";
import type { Task } from "@/data/schemas";
import {
  busyBlocksFromAgenda,
  capacityLine,
  DAY_END_MIN,
  freeMinutes,
  RITUAL_ESTIMATE_CHOICES,
  ritualSteps,
  sumEstimates,
  visibleRollover,
} from "./ritual-logic";
import { formatMin } from "../format-min";
import { parseRitualDay, ritualKey, staleRitualKeys } from "./ritual-state";

const AUDIT = {
  created_at: "2026-07-16T08:00:00.000Z",
  updated_at: "2026-07-16T08:00:00.000Z",
  deleted_at: null,
};

function task(over: Partial<Task> & { id: string }): Task {
  return {
    title: "Task",
    notes: null,
    date: "2026-07-16",
    time: null,
    priority: null,
    tags: [],
    module_link: null,
    status: "open",
    completed_at: null,
    recurrence: null,
    estimate_min: null,
    sort_order: 0,
    subtasks: [],
    ...AUDIT,
    ...over,
  };
}

describe("ritualSteps — i passi disponibili", () => {
  it("tutto pieno: quattro passi in ordine", () => {
    expect(ritualSteps(2, 3)).toEqual([
      "rollover",
      "lista",
      "ordine",
      "capacita",
    ]);
  });

  it("senza arretrati il rollover non esiste", () => {
    expect(ritualSteps(0, 3)).toEqual(["lista", "ordine", "capacita"]);
  });

  it("con meno di due task l'ordine non ha senso", () => {
    expect(ritualSteps(1, 1)).toEqual(["rollover", "lista", "capacita"]);
    expect(ritualSteps(0, 0)).toEqual(["lista", "capacita"]);
  });
});

describe("visibleRollover — i candidati ancora da decidere", () => {
  it("filtra i lasciati, preserva l'ordine", () => {
    const a = task({ id: "a", date: "2026-07-14" });
    const b = task({ id: "b", date: "2026-07-15" });
    const c = task({ id: "c", date: "2026-07-15" });
    expect(visibleRollover([a, b, c], new Set(["b"]))).toEqual([a, c]);
    expect(visibleRollover([a, b, c], new Set())).toEqual([a, b, c]);
    expect(visibleRollover([], new Set(["b"]))).toEqual([]);
  });
});

describe("sumEstimates — solo le stime presenti", () => {
  it("somma i minuti, i senza-stima contano zero", () => {
    expect(
      sumEstimates([
        task({ id: "a", estimate_min: 30 }),
        task({ id: "b" }),
        task({ id: "c", estimate_min: 90 }),
      ]),
    ).toBe(120);
    expect(sumEstimates([])).toBe(0);
  });
});

describe("busyBlocksFromAgenda — solo eventi con orario", () => {
  it("scarta task, all-day e voci senza inizio; default 60' senza fine", () => {
    const blocks = busyBlocksFromAgenda([
      { source: "event", allDay: false, start: "09:00", end: "10:30" },
      { source: "google", allDay: false, start: "14:00", end: null },
      { source: "task", allDay: false, start: "11:00", end: "12:00" },
      { source: "event", allDay: true, start: null, end: null },
      { source: "google", allDay: false, start: null, end: null },
    ]);
    expect(blocks).toEqual([
      { startMin: 540, endMin: 630 },
      { startMin: 840, endMin: 900 },
    ]);
  });

  it("fine non oltre l'inizio → default 60', cap a mezzanotte", () => {
    expect(
      busyBlocksFromAgenda([
        { source: "event", allDay: false, start: "18:00", end: "18:00" },
        { source: "event", allDay: false, start: "23:30", end: null },
      ]),
    ).toEqual([
      { startMin: 1080, endMin: 1140 },
      { startMin: 1410, endMin: 1440 },
    ]);
  });
});

describe("freeMinutes — la finestra da adesso a fine giornata", () => {
  it("senza blocchi: tutta la finestra", () => {
    // 09:00 → 23:00 = 14h.
    expect(freeMinutes(9 * 60, [])).toBe(14 * 60);
  });

  it("toglie i blocchi, fonde le sovrapposizioni", () => {
    const blocks = [
      { startMin: 10 * 60, endMin: 11 * 60 },
      { startMin: 10 * 60 + 30, endMin: 12 * 60 }, // sovrapposto
      { startMin: 20 * 60, endMin: 21 * 60 },
    ];
    // 09:00→23:00 = 840' − (10:00→12:00 = 120') − (20:00→21:00 = 60')
    expect(freeMinutes(9 * 60, blocks)).toBe(840 - 120 - 60);
  });

  it("clampa i blocchi alla finestra (passato e oltre-fine non contano)", () => {
    const blocks = [
      { startMin: 6 * 60, endMin: 10 * 60 }, // già in corso alle 9
      { startMin: 22 * 60, endMin: 24 * 60 }, // sfora la fine
    ];
    // 840' − (09:00→10:00 = 60') − (22:00→23:00 = 60')
    expect(freeMinutes(9 * 60, blocks)).toBe(840 - 60 - 60);
  });

  it("finestra chiusa o negativa = 0, mai negativo", () => {
    expect(freeMinutes(DAY_END_MIN, [])).toBe(0);
    expect(freeMinutes(DAY_END_MIN + 30, [])).toBe(0);
    expect(
      freeMinutes(22 * 60, [{ startMin: 0, endMin: 24 * 60 }]),
    ).toBe(0);
  });
});

describe("formatMin — minuti in forma umana", () => {
  it("sotto l'ora i primi, poi ore compatte", () => {
    expect(formatMin(45)).toBe("45'");
    expect(formatMin(60)).toBe("1h");
    expect(formatMin(90)).toBe("1h30");
    expect(formatMin(330)).toBe("5h30");
    expect(formatMin(305)).toBe("5h05");
    expect(formatMin(0)).toBe("0'");
    expect(formatMin(-10)).toBe("0'");
  });

  it("le scelte del rituale si formattano come i chip", () => {
    expect(RITUAL_ESTIMATE_CHOICES.map(formatMin)).toEqual([
      "15'",
      "30'",
      "1h",
      "1h30",
    ]);
  });
});

describe("capacityLine — gentile, mai bloccante", () => {
  it("senza stime: nessuna riga", () => {
    expect(capacityLine(0, 300)).toBeNull();
  });

  it("sopra il tempo libero: la riga del brief", () => {
    expect(capacityLine(330, 240)).toEqual({
      over: true,
      text: "Hai pianificato 5h30 su ~4h libere.",
    });
  });

  it("dentro il tempo libero: stessa forma, nessun allarme", () => {
    expect(capacityLine(90, 240)).toEqual({
      over: false,
      text: "Stimato 1h30 su ~4h libere.",
    });
  });
});

describe("stato per-giorno — parse difensivo e potatura", () => {
  it("roundtrip di uno stato valido", () => {
    const raw = JSON.stringify({
      dismissed: true,
      planned_at: "2026-07-16T07:30:00.000Z",
      tasks_planned: 4,
      estimated_min: 150,
      free_min: 300,
    });
    expect(parseRitualDay(raw)).toEqual({
      dismissed: true,
      planned_at: "2026-07-16T07:30:00.000Z",
      tasks_planned: 4,
      estimated_min: 150,
      free_min: 300,
    });
  });

  it("forme sporche: mai throw, campi invalidi scartati", () => {
    expect(parseRitualDay(null)).toBeNull();
    expect(parseRitualDay("non-json")).toBeNull();
    expect(parseRitualDay("[1,2]")).toBeNull();
    expect(parseRitualDay('"stringa"')).toBeNull();
    expect(
      parseRitualDay(
        JSON.stringify({
          dismissed: "sì",
          planned_at: 42,
          tasks_planned: -1,
          estimated_min: "molto",
          free_min: -5,
        }),
      ),
    ).toEqual({});
  });

  it("staleRitualKeys tiene solo il giorno corrente", () => {
    const keys = [
      ritualKey("2026-07-15"),
      ritualKey("2026-07-16"),
      "lifeos.brief.2026-07-15",
      "altro",
    ];
    expect(staleRitualKeys(keys, "2026-07-16")).toEqual([
      ritualKey("2026-07-15"),
    ]);
  });
});
