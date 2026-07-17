import { describe, expect, it } from "vitest";
import type { WeekSlotEntry } from "@/data/planner";
import type { AgendaItem } from "../calendar/agenda";
import {
  buildTimedStream,
  nowCursorIndex,
  orderBandTasks,
} from "./timeline-logic";

const AUDIT = {
  created_at: "2026-07-16T08:00:00.000Z",
  updated_at: "2026-07-16T08:00:00.000Z",
  deleted_at: null,
};

function item(over: Partial<AgendaItem> & { key: string }): AgendaItem {
  return {
    source: "event",
    id: over.key,
    title: "Voce",
    allDay: false,
    start: "09:00",
    end: null,
    done: false,
    ...over,
  };
}

function slotEntry(id: string, start: string): WeekSlotEntry {
  return {
    slot: {
      id,
      plan_id: "p1",
      weekday: 4,
      start_hhmm: start,
      end_hhmm: null,
      title: "Slot",
      notes: null,
      sort_order: 0,
      ...AUDIT,
    },
    check: null,
    state: null,
  };
}

describe("buildTimedStream — un flusso, in ordine d'ora", () => {
  it("fonde slot, voci e focus per minuto d'inizio", () => {
    const stream = buildTimedStream({
      items: [
        item({ key: "e1", start: "10:00" }),
        item({ key: "t1", source: "task", start: "08:30" }),
      ],
      slots: [slotEntry("s1", "09:00")],
      focus: [{ id: "f1", hhmm: "08:00", minutes: 25 }],
    });
    expect(
      stream.map((e) =>
        e.kind === "item" ? e.item.key : e.kind === "slot" ? e.entry.slot.id : e.id,
      ),
    ).toEqual(["f1", "t1", "s1", "e1"]);
  });

  it("a parità di minuto: slot, poi voce, poi focus; scarta all-day e senza ora", () => {
    const stream = buildTimedStream({
      items: [
        item({ key: "allday", allDay: true, start: null }),
        item({ key: "senzaora", start: null }),
        item({ key: "e", start: "09:00" }),
      ],
      slots: [slotEntry("s", "09:00")],
      focus: [{ id: "f", hhmm: "09:00", minutes: 25 }],
    });
    expect(
      stream.map((e) =>
        e.kind === "item" ? e.item.key : e.kind === "slot" ? e.entry.slot.id : e.id,
      ),
    ).toEqual(["s", "e", "f"]);
  });

  it("ordine d'arrivo stabile dentro la stessa specie", () => {
    const stream = buildTimedStream({
      items: [
        item({ key: "a", start: "09:00" }),
        item({ key: "b", start: "09:00" }),
      ],
      slots: [],
      focus: [],
    });
    expect(stream.map((e) => (e.kind === "item" ? e.item.key : ""))).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("nowCursorIndex — dove cade adesso", () => {
  const stream = buildTimedStream({
    items: [
      item({ key: "a", start: "09:00" }),
      item({ key: "b", start: "14:00" }),
    ],
    slots: [],
    focus: [],
  });

  it("prima della prima voce futura; le voci del minuto corrente restano sopra", () => {
    expect(nowCursorIndex(stream, 8 * 60)).toBe(0);
    expect(nowCursorIndex(stream, 9 * 60)).toBe(1); // 09:00 è "in corso"
    expect(nowCursorIndex(stream, 12 * 60)).toBe(1);
  });

  it("giornata finita o lista vuota: in coda", () => {
    expect(nowCursorIndex(stream, 23 * 60)).toBe(2);
    expect(nowCursorIndex([], 10 * 60)).toBe(0);
  });
});

describe("orderBandTasks — la playlist nella fascia senza orario", () => {
  it("eventi prima com'erano, task nell'ordine playlist", () => {
    const band = [
      item({ key: "ev", allDay: true, start: null }),
      item({ key: "t-b", id: "b", source: "task", allDay: true, start: null }),
      item({ key: "t-a", id: "a", source: "task", allDay: true, start: null }),
    ];
    const ordered = orderBandTasks(band, ["a", "b"]);
    expect(ordered.map((i) => i.key)).toEqual(["ev", "t-a", "t-b"]);
  });

  it("task fuori playlist in coda, ordine d'arrivo; band senza task intatta", () => {
    const band = [
      item({ key: "t-x", id: "x", source: "task", allDay: true, start: null }),
      item({ key: "t-a", id: "a", source: "task", allDay: true, start: null }),
      item({ key: "t-y", id: "y", source: "task", allDay: true, start: null }),
    ];
    expect(orderBandTasks(band, ["a"]).map((i) => i.key)).toEqual([
      "t-a",
      "t-x",
      "t-y",
    ]);
    const soloEventi = [item({ key: "e1", allDay: true, start: null })];
    expect(orderBandTasks(soloEventi, [])).toEqual(soloEventi);
  });
});
