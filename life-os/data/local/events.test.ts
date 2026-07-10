import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LifeosDb } from "../db";
import { LocalEventsRepo } from "./events";

let counter = 0;
let db: LifeosDb;
let repo: LocalEventsRepo;

beforeEach(() => {
  db = new LifeosDb(`test-events-${++counter}`);
  repo = new LocalEventsRepo(db);
});

afterEach(async () => {
  await db.delete();
});

async function mustCreate(input: Parameters<LocalEventsRepo["create"]>[0]) {
  const r = await repo.create(input);
  if (!r.ok) throw new Error(`create fallita: ${r.error.message}`);
  return r.data;
}

describe("LocalEventsRepo", () => {
  it("create: senza orario diventa all-day, con orario no", async () => {
    const allDay = await mustCreate({ title: "Compleanno", date: "2026-07-12" });
    expect(allDay.all_day).toBe(true);
    const timed = await mustCreate({
      title: "Cena",
      date: "2026-07-12",
      start_time: "20:30",
    });
    expect(timed.all_day).toBe(false);
    expect(timed.start_time).toBe("20:30");
  });

  it("create rifiuta date non valide", async () => {
    const r = await repo.create({ title: "x", date: "12/07/2026" });
    expect(!r.ok && r.error.code).toBe("validation");
  });

  it("update modifica e bumpa updated_at; not_found su tombstone", async () => {
    const ev = await mustCreate({ title: "Cena", date: "2026-07-12" });
    const r = await repo.update(ev.id, { start_time: "21:00", all_day: false });
    expect(r.ok && r.data.start_time).toBe("21:00");
    if (r.ok) expect(r.data.updated_at >= ev.updated_at).toBe(true);

    await repo.softDelete(ev.id);
    const gone = await repo.update(ev.id, { title: "y" });
    expect(!gone.ok && gone.error.code).toBe("not_found");
  });

  it("listByDay: all-day prima, poi per orario; tombstone escluse", async () => {
    const late = await mustCreate({
      title: "Sera",
      date: "2026-07-12",
      start_time: "21:00",
    });
    const early = await mustCreate({
      title: "Mattina",
      date: "2026-07-12",
      start_time: "08:00",
    });
    const allDay = await mustCreate({ title: "Festa", date: "2026-07-12" });
    const deleted = await mustCreate({ title: "X", date: "2026-07-12" });
    await repo.softDelete(deleted.id);

    const day = await repo.listByDay("2026-07-12");
    expect(day.map((e) => e.id)).toEqual([allDay.id, early.id, late.id]);
  });

  it("listRange: inclusivo e ordinato per giorno", async () => {
    const d2 = await mustCreate({ title: "b", date: "2026-07-13" });
    const d1 = await mustCreate({ title: "a", date: "2026-07-12" });
    await mustCreate({ title: "fuori", date: "2026-08-01" });
    const range = await repo.listRange("2026-07-12", "2026-07-14");
    expect(range.map((e) => e.id)).toEqual([d1.id, d2.id]);
  });

  it("la tombstone resta fisicamente e purge la rimuove", async () => {
    const ev = await mustCreate({ title: "X", date: "2026-07-12" });
    await repo.softDelete(ev.id);
    expect(await db.events.get(ev.id)).toBeDefined();
    const purged = await repo.purgeTombstones("2100-01-01T00:00:00.000Z");
    expect(purged.ok && purged.data).toBe(1);
    expect(await db.events.get(ev.id)).toBeUndefined();
  });
});
