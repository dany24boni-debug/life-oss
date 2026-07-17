import { describe, expect, it } from "vitest";
import type { WeekSlotEntry } from "@/data/planner";
import type { PlanSlot } from "@/data/schemas";
import {
  adessoEntry,
  completionPct,
  findNowSlot,
  gymDayForSlot,
  hhmmInZone,
  hhmmToMinutes,
  nextStateOnLong,
  nextStateOnTap,
  remainingCount,
  weekRangeLabel,
} from "./logic";

function entry(
  id: string,
  start: string,
  end: string | null = null,
  state: "done" | "skipped" | null = null,
): WeekSlotEntry {
  const slot = {
    id,
    plan_id: "p",
    weekday: 1,
    start_hhmm: start,
    end_hhmm: end,
    title: id,
    notes: null,
    sort_order: 0,
    created_at: "2026-06-01T08:00:00.000Z",
    updated_at: "2026-06-01T08:00:00.000Z",
    deleted_at: null,
  } as PlanSlot;
  return { slot, check: null, state };
}

describe("findNowSlot — lo slot in corso e il prossimo", () => {
  const day = [
    entry("palestra", "07:00", "08:30"),
    entry("deepwork", "09:00"),
    entry("pranzo", "13:00", "14:00"),
  ];

  it("dentro una fascia con fine esplicita", () => {
    expect(findNowSlot(day, "07:45")).toEqual({
      currentId: "palestra",
      nextId: "deepwork",
    });
  });

  it("nel buco tra due slot: nessun corrente, solo il prossimo", () => {
    expect(findNowSlot(day, "08:45")).toEqual({
      currentId: null,
      nextId: "deepwork",
    });
  });

  it("slot senza fine: dura fino al prossimo, con un'ora di cortesia", () => {
    // 09:00 senza fine, prossimo alle 13: la cortesia limita a 10:00.
    expect(findNowSlot(day, "09:30").currentId).toBe("deepwork");
    expect(findNowSlot(day, "11:00")).toEqual({
      currentId: null,
      nextId: "pranzo",
    });
  });

  it("dopo l'ultimo slot: niente corrente, niente prossimo", () => {
    expect(findNowSlot(day, "15:00")).toEqual({
      currentId: null,
      nextId: null,
    });
  });

  it("giornata vuota: tutto null", () => {
    expect(findNowSlot([], "10:00")).toEqual({ currentId: null, nextId: null });
  });
});

describe("adessoEntry — la card di Oggi", () => {
  const day = [entry("palestra", "07:00", "08:30"), entry("spesa", "18:00")];

  it("in corso vince sul prossimo", () => {
    expect(adessoEntry(day, "07:30")?.kind).toBe("current");
    expect(adessoEntry(day, "07:30")?.entry.slot.id).toBe("palestra");
  });

  it("tra gli slot: il prossimo", () => {
    const a = adessoEntry(day, "12:00");
    expect(a?.kind).toBe("next");
    expect(a?.entry.slot.id).toBe("spesa");
  });

  it("giornata finita: null", () => {
    expect(adessoEntry(day, "23:30")).toBeNull();
  });
});

describe("conteggi e etichette", () => {
  it("remainingCount conta solo gli slot senza esito", () => {
    expect(
      remainingCount([
        entry("a", "07:00", null, "done"),
        entry("b", "09:00", null, "skipped"),
        entry("c", "10:00"),
      ]),
    ).toBe(1);
  });

  it("completionPct onesto: null senza slot", () => {
    expect(completionPct(3, 4)).toBe(75);
    expect(completionPct(0, 0)).toBeNull();
  });

  it("weekRangeLabel dentro e a cavallo di mese", () => {
    expect(weekRangeLabel("2026-W28")).toBe("6–12 lug");
    // W40 2026: 28 settembre – 4 ottobre.
    expect(weekRangeLabel("2026-W40")).toBe("28 set – 4 ott");
  });

  it("hhmm helpers", () => {
    expect(hhmmToMinutes("07:30")).toBe(450);
    expect(hhmmInZone(new Date("2026-07-12T22:30:00.000Z"), "Europe/Rome")).toBe(
      "00:30",
    );
    expect(hhmmInZone(new Date("2026-07-12T22:30:00.000Z"), "Not/AZone")).toBe(
      "22:30",
    );
  });
});

describe("macchina degli stati del check", () => {
  it("tap: null → fatto → null; saltato → fatto", () => {
    expect(nextStateOnTap(null)).toBe("done");
    expect(nextStateOnTap("done")).toBeNull();
    expect(nextStateOnTap("skipped")).toBe("done");
  });

  it("gesto lungo: sempre saltato, ri-lungo annulla", () => {
    expect(nextStateOnLong(null)).toBe("skipped");
    expect(nextStateOnLong("done")).toBe("skipped");
    expect(nextStateOnLong("skipped")).toBeNull();
  });
});

describe("gymDayForSlot — lo slot Palestra conosce la scheda (run-11)", () => {
  const days = [
    { id: "a", name: "Torso A", weekday: 1 },
    { id: "b", name: "Gambe", weekday: null },
    { id: "c", name: "Torso B", weekday: 4 },
  ];

  it("titolo palestra + weekday impostato: vince il giorno del weekday", () => {
    expect(gymDayForSlot("07:00 Palestra", 4, days, "a")).toEqual({
      id: "c",
      name: "Torso B",
    });
    expect(gymDayForSlot("Gym serale", 1, days, null)).toEqual({
      id: "a",
      name: "Torso A",
    });
  });

  it("weekday non mappato: cade sul suggerito della rotazione", () => {
    expect(gymDayForSlot("Palestra", 2, days, "b")).toEqual({
      id: "b",
      name: "Gambe",
    });
    expect(gymDayForSlot("Palestra", 2, days, null)).toBeNull();
  });

  it("titolo non-palestra o senza giorni: null, lo slot resta slot", () => {
    expect(gymDayForSlot("Studio", 1, days, "a")).toBeNull();
    expect(gymDayForSlot("Palestra", 1, [], "a")).toBeNull();
    // "Allenamento" e "workout" matchano; "spalestrato" no (word boundary).
    expect(gymDayForSlot("Allenamento", 4, days, null)?.id).toBe("c");
    expect(gymDayForSlot("spalestrato", 4, days, null)).toBeNull();
  });
});
