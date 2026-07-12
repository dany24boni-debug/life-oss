import { describe, expect, it } from "vitest";
import type { PlanSlot, SlotCheck } from "./schemas";
import {
  computeWeekBoard,
  computeWeekStats,
  currentIsoWeek,
  isoWeekDays,
  isoWeekOf,
  shiftIsoWeek,
} from "./planner";

describe("isoWeekOf — settimane ISO 8601", () => {
  it("valori noti a metà anno", () => {
    expect(isoWeekOf("2026-07-12")).toBe("2026-W28"); // domenica
    expect(isoWeekOf("2026-07-13")).toBe("2026-W29"); // lunedì
  });

  it("confine d'anno: la settimana appartiene all'anno del suo giovedì", () => {
    // Il 2026 inizia di giovedì: la W01 parte dal 29 dicembre 2025.
    expect(isoWeekOf("2025-12-29")).toBe("2026-W01");
    expect(isoWeekOf("2025-12-28")).toBe("2025-W52");
    expect(isoWeekOf("2026-01-01")).toBe("2026-W01");
    expect(isoWeekOf("2026-01-04")).toBe("2026-W01");
    // Il 2026 ha 53 settimane: il 1° gennaio 2027 (venerdì) è ancora 2026-W53.
    expect(isoWeekOf("2026-12-28")).toBe("2026-W53");
    expect(isoWeekOf("2027-01-01")).toBe("2026-W53");
    expect(isoWeekOf("2027-01-03")).toBe("2026-W53");
    expect(isoWeekOf("2027-01-04")).toBe("2027-W01");
    // E il 2025 inizia in una settimana che appartiene già al 2025.
    expect(isoWeekOf("2024-12-30")).toBe("2025-W01");
  });

  it("i giorni dei cambi d'ora europei restano nelle loro settimane", () => {
    expect(isoWeekOf("2026-03-29")).toBe("2026-W13"); // domenica del +1h
    expect(isoWeekOf("2026-10-25")).toBe("2026-W43"); // domenica del −1h
  });
});

describe("isoWeekDays / shiftIsoWeek / currentIsoWeek", () => {
  it("i 7 giorni lun->dom, anche a cavallo d'anno", () => {
    expect(isoWeekDays("2026-W01")).toEqual([
      "2025-12-29",
      "2025-12-30",
      "2025-12-31",
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
    ]);
    expect(isoWeekDays("2026-W28")[0]).toBe("2026-07-06");
    expect(isoWeekDays("2026-W28")[6]).toBe("2026-07-12");
  });

  it("shift attraversa i confini d'anno per costruzione", () => {
    expect(shiftIsoWeek("2026-W28", 1)).toBe("2026-W29");
    expect(shiftIsoWeek("2026-W01", -1)).toBe("2025-W52");
    expect(shiftIsoWeek("2026-W53", 1)).toBe("2027-W01");
    expect(shiftIsoWeek("2027-W01", -1)).toBe("2026-W53");
  });

  it("currentIsoWeek passa dal giorno civile della zona (Europe/Rome)", () => {
    // 22:30 UTC di domenica = 00:30 di lunedì a Roma: settimana nuova.
    expect(currentIsoWeek("2026-07-12T22:30:00.000Z", "Europe/Rome")).toBe(
      "2026-W29",
    );
    expect(currentIsoWeek("2026-07-12T22:30:00.000Z", "UTC")).toBe("2026-W28");
  });
});

/* ── Fixture per board e stats ───────────────────────────────────────── */

const AUDIT = {
  created_at: "2026-06-01T08:00:00.000Z",
  updated_at: "2026-06-01T08:00:00.000Z",
  deleted_at: null,
};

function slot(
  id: string,
  weekday: number,
  start: string,
  title: string,
  extra?: Partial<PlanSlot>,
): PlanSlot {
  return {
    id,
    plan_id: "00000000-0000-8000-8000-000000000001",
    weekday,
    start_hhmm: start,
    end_hhmm: null,
    title,
    notes: null,
    sort_order: 0,
    ...AUDIT,
    ...extra,
  };
}

function check(
  slotId: string,
  isoWeek: string,
  state: "done" | "skipped" | null,
): SlotCheck {
  return {
    id: `${slotId.slice(0, 30)}:${isoWeek}`.padEnd(36, "0"),
    slot_id: slotId,
    iso_week: isoWeek,
    state,
    checked_at: state === null ? null : "2026-07-06T08:00:00.000Z",
    ...AUDIT,
  };
}

const S1 = "00000000-0000-8000-8000-0000000000a1";
const S2 = "00000000-0000-8000-8000-0000000000a2";
const S3 = "00000000-0000-8000-8000-0000000000a3";

describe("computeWeekBoard", () => {
  it("7 giorni lun->dom con date della settimana e slot per orario", () => {
    const slots = [
      slot(S2, 1, "09:00", "Deep work"),
      slot(S1, 1, "07:00", "Palestra"),
      slot(S3, 3, "18:00", "Spesa"),
    ];
    const board = computeWeekBoard(
      slots,
      [check(S1, "2026-W28", "done")],
      "2026-W28",
    );
    expect(board).toHaveLength(7);
    expect(board[0].date).toBe("2026-07-06");
    expect(board[6].date).toBe("2026-07-12");
    expect(board[0].slots.map((e) => e.slot.title)).toEqual([
      "Palestra",
      "Deep work",
    ]);
    expect(board[0].slots[0].state).toBe("done");
    expect(board[0].slots[1].state).toBeNull();
    expect(board[2].slots.map((e) => e.slot.title)).toEqual(["Spesa"]);
    expect(board[1].slots).toHaveLength(0);
  });

  it("a parità d'ora decide sort_order", () => {
    const slots = [
      slot(S1, 1, "07:00", "Secondo", { sort_order: 1 }),
      slot(S2, 1, "07:00", "Primo", { sort_order: 0 }),
    ];
    const board = computeWeekBoard(slots, [], "2026-W28");
    expect(board[0].slots.map((e) => e.slot.title)).toEqual([
      "Primo",
      "Secondo",
    ]);
  });
});

describe("computeWeekStats — completamento e 'salti più spesso'", () => {
  it("per-settimana: fatti/saltati; nelle chiuse il non-toccato è saltato", () => {
    const slots = [
      slot(S1, 1, "07:00", "Palestra"),
      slot(S2, 2, "09:00", "Deep work"),
    ];
    const checks = [
      check(S1, "2026-W26", "done"),
      // S2 mai toccato in W26 (chiusa): salto silenzioso.
      check(S1, "2026-W27", "skipped"),
      check(S2, "2026-W27", "done"),
      check(S1, "2026-W28", "done"),
      // S2 non ancora toccato in W28 (corrente): NON conta come salto.
    ];
    const stats = computeWeekStats(slots, checks, "2026-W28", 3);
    expect(stats.weeks).toEqual([
      { isoWeek: "2026-W26", total: 2, done: 1, skipped: 1 },
      { isoWeek: "2026-W27", total: 2, done: 1, skipped: 1 },
      { isoWeek: "2026-W28", total: 2, done: 1, skipped: 0 },
    ]);
  });

  it("classifica: salti espliciti + silenziosi nelle settimane chiuse", () => {
    const slots = [
      slot(S1, 1, "07:00", "Palestra"),
      slot(S2, 2, "09:00", "Deep work"),
      slot(S3, 5, "18:00", "Pulizie"),
    ];
    const checks = [
      // S3: saltato esplicito in W26, mai toccato in W27 → missed 2.
      check(S3, "2026-W26", "skipped"),
      check(S1, "2026-W26", "done"),
      check(S1, "2026-W27", "done"),
      check(S2, "2026-W26", "done"),
      // S2 mai toccato in W27 → missed 1.
      // S1 fatto sempre → missed 0, fuori classifica.
    ];
    const stats = computeWeekStats(slots, checks, "2026-W28", 3);
    expect(stats.mostSkipped.map((r) => r.slot.title)).toEqual([
      "Pulizie",
      "Deep work",
    ]);
    expect(stats.mostSkipped[0]).toMatchObject({ missed: 2, done: 0, weeks: 2 });
    expect(stats.mostSkipped[1]).toMatchObject({ missed: 1, done: 1, weeks: 2 });
  });

  it("uno slot creato dopo non 'manca' nelle settimane in cui non c'era", () => {
    const vecchio = slot(S1, 1, "07:00", "Palestra");
    const nuovo = slot(S2, 2, "09:00", "Lettura", {
      created_at: "2026-07-08T08:00:00.000Z", // mercoledì della W28
      updated_at: "2026-07-08T08:00:00.000Z",
    });
    const stats = computeWeekStats([vecchio, nuovo], [], "2026-W28", 3);
    // W26/W27: solo lo slot vecchio esiste.
    expect(stats.weeks[0]).toMatchObject({ isoWeek: "2026-W26", total: 1 });
    expect(stats.weeks[1]).toMatchObject({ isoWeek: "2026-W27", total: 1 });
    expect(stats.weeks[2]).toMatchObject({ isoWeek: "2026-W28", total: 2 });
    // E la classifica non incolpa il nuovo per settimane mai viste.
    expect(stats.mostSkipped.map((r) => r.slot.title)).toEqual(["Palestra"]);
  });
});
