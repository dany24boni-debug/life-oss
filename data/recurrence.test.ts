import { describe, expect, it } from "vitest";
import {
  addDaysCivil,
  buildSpawnTask,
  firstOccurrence,
  maxDay,
  nextOccurrence,
  normalizeRecurrence,
  recurrenceLabel,
} from "./recurrence";
import type { Task } from "./schemas";

// 2026-07-13 è lunedì (ISO 1).

describe("nextOccurrence — strettamente dopo", () => {
  it("daily: sempre il giorno dopo", () => {
    expect(nextOccurrence({ freq: "daily" }, "2026-07-13")).toBe("2026-07-14");
    // Confine di mese e anno.
    expect(nextOccurrence({ freq: "daily" }, "2026-07-31")).toBe("2026-08-01");
    expect(nextOccurrence({ freq: "daily" }, "2026-12-31")).toBe("2027-01-01");
  });

  it("weekly: il prossimo giorno previsto, mai lo stesso giorno", () => {
    // Lunedì con regola "ogni lunedì": il PROSSIMO lunedì.
    expect(
      nextOccurrence({ freq: "weekly", weekdays: [1] }, "2026-07-13"),
    ).toBe("2026-07-20");
    // Lunedì con "lun e gio": giovedì.
    expect(
      nextOccurrence({ freq: "weekly", weekdays: [1, 4] }, "2026-07-13"),
    ).toBe("2026-07-16");
    // Sabato con "nei feriali": lunedì.
    expect(
      nextOccurrence(
        { freq: "weekly", weekdays: [1, 2, 3, 4, 5] },
        "2026-07-18",
      ),
    ).toBe("2026-07-20");
  });

  it("attraversa i cambi d'ora 2026 senza saltare giorni", () => {
    // DST marzo (29/03) e ottobre (25/10) 2026 in Europa.
    expect(nextOccurrence({ freq: "daily" }, "2026-03-28")).toBe("2026-03-29");
    expect(nextOccurrence({ freq: "daily" }, "2026-10-24")).toBe("2026-10-25");
    expect(addDaysCivil("2026-03-29", 1)).toBe("2026-03-30");
  });
});

describe("firstOccurrence — oggi incluso", () => {
  it("daily parte oggi; weekly oggi se previsto, altrimenti il prossimo", () => {
    expect(firstOccurrence({ freq: "daily" }, "2026-07-13")).toBe(
      "2026-07-13",
    );
    expect(
      firstOccurrence({ freq: "weekly", weekdays: [1] }, "2026-07-13"),
    ).toBe("2026-07-13"); // lunedì con "ogni lunedì": oggi
    expect(
      firstOccurrence({ freq: "weekly", weekdays: [4] }, "2026-07-13"),
    ).toBe("2026-07-16"); // giovedì
  });
});

describe("normalizeRecurrence e recurrenceLabel", () => {
  it("dedupe + sort; tutti e 7 i giorni = daily", () => {
    expect(
      normalizeRecurrence({ freq: "weekly", weekdays: [4, 1, 4, 1] }),
    ).toEqual({ freq: "weekly", weekdays: [1, 4] });
    expect(
      normalizeRecurrence({ freq: "weekly", weekdays: [1, 2, 3, 4, 5, 6, 7] }),
    ).toEqual({ freq: "daily" });
    expect(normalizeRecurrence({ freq: "daily" })).toEqual({ freq: "daily" });
  });

  it("etichette: ogni giorno, nei feriali, liste", () => {
    expect(recurrenceLabel({ freq: "daily" })).toBe("ogni giorno");
    expect(
      recurrenceLabel({ freq: "weekly", weekdays: [1, 2, 3, 4, 5] }),
    ).toBe("nei feriali");
    expect(recurrenceLabel({ freq: "weekly", weekdays: [1] })).toBe(
      "ogni lun",
    );
    expect(recurrenceLabel({ freq: "weekly", weekdays: [1, 3, 5] })).toBe(
      "ogni lun, mer e ven",
    );
  });

  it("maxDay: confronto civile", () => {
    expect(maxDay("2026-07-13", "2026-07-10")).toBe("2026-07-13");
    expect(maxDay("2026-07-10", "2026-07-13")).toBe("2026-07-13");
  });
});

describe("buildSpawnTask — la prossima istanza, pura", () => {
  const completed: Task = {
    id: "aaaa1111-0000-4000-8000-000000000001",
    title: "Palestra",
    notes: "Torso A",
    date: "2026-07-13",
    time: "18:00",
    priority: 2,
    tags: ["salute"],
    module_link: { kind: "gym", ref_id: null },
    status: "done",
    completed_at: "2026-07-13T19:00:00.000Z",
    recurrence: { freq: "weekly", weekdays: [1, 4] },
    estimate_min: 45,
    sort_order: 3,
    subtasks: [
      { id: "bbbb1111-0000-4000-8000-000000000001", title: "Borsa", done: true },
    ],
    created_at: "2026-07-01T08:00:00.000Z",
    updated_at: "2026-07-13T19:00:00.000Z",
    deleted_at: null,
  };

  it("porta regola, titolo, orario, priorità, tag; sottotask azzerati", () => {
    const spawn = buildSpawnTask(completed, {
      id: "84131898-837d-8b53-8c2d-19a8b103a654",
      date: "2026-07-16",
      now: "2026-07-13T19:00:01.000Z",
      sortOrder: 9,
    });
    expect(spawn.id).toBe("84131898-837d-8b53-8c2d-19a8b103a654");
    expect(spawn.date).toBe("2026-07-16");
    expect(spawn.time).toBe("18:00");
    expect(spawn.status).toBe("open");
    expect(spawn.completed_at).toBeNull();
    expect(spawn.recurrence).toEqual({ freq: "weekly", weekdays: [1, 4] });
    // La stima viaggia con l'occorrenza (run-11).
    expect(spawn.estimate_min).toBe(45);
    expect(spawn.tags).toEqual(["salute"]);
    expect(spawn.subtasks).toEqual([
      { id: "bbbb1111-0000-4000-8000-000000000001", title: "Borsa", done: false },
    ]);
    expect(spawn.deleted_at).toBeNull();
  });
});
