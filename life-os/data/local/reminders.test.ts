import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LifeosDb } from "../db";
import type { Result } from "../result";
import { uuidv7 } from "../ids";
import { LocalRemindersRepo } from "./reminders";

let counter = 0;
let db: LifeosDb;
let repo: LocalRemindersRepo;

beforeEach(() => {
  db = new LifeosDb(`test-reminders-${++counter}`);
  repo = new LocalRemindersRepo(db);
});

afterEach(async () => {
  await db.delete();
});

async function must<T>(p: Promise<Result<T>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(`operazione fallita: ${r.error.message}`);
  return r.data;
}

const T0 = "2026-07-10T08:00:00.000Z";
const T1 = "2026-07-10T09:00:00.000Z";
const T2 = "2026-07-10T10:00:00.000Z";

describe("LocalRemindersRepo", () => {
  it("listPending: scaduti e mai gestiti, in ordine di scatto", async () => {
    const late = await must(
      repo.create({ kind: "task", ref_id: uuidv7(), fire_at: T1 }),
    );
    const early = await must(
      repo.create({ kind: "task", ref_id: uuidv7(), fire_at: T0 }),
    );
    await must(repo.create({ kind: "task", ref_id: uuidv7(), fire_at: T2 })); // futuro

    const pending = await repo.listPending(T1);
    expect(pending.map((r) => r.id)).toEqual([early.id, late.id]);
  });

  it("markFired e dismiss escludono dai pending", async () => {
    const a = await must(
      repo.create({ kind: "task", ref_id: uuidv7(), fire_at: T0 }),
    );
    const b = await must(
      repo.create({ kind: "event", ref_id: uuidv7(), fire_at: T0 }),
    );
    await must(repo.markFired(a.id, T1));
    await must(repo.dismiss(b.id, T1));
    expect(await repo.listPending(T2)).toEqual([]);
  });

  it("update di fire_at riarma il promemoria", async () => {
    const a = await must(
      repo.create({ kind: "task", ref_id: uuidv7(), fire_at: T0 }),
    );
    await must(repo.markFired(a.id, T0));
    const updated = await must(repo.update(a.id, { fire_at: T2 }));
    expect(updated.fired_at).toBeNull();
    const pending = await repo.listPending(T2);
    expect(pending.map((r) => r.id)).toEqual([a.id]);
  });

  it("listUpcoming: range inclusivo, esclude dismissed", async () => {
    const a = await must(
      repo.create({ kind: "task", ref_id: uuidv7(), fire_at: T1 }),
    );
    const b = await must(
      repo.create({ kind: "task", ref_id: uuidv7(), fire_at: T2 }),
    );
    await must(repo.dismiss(b.id, T0));
    const upcoming = await repo.listUpcoming(T0, T2);
    expect(upcoming.map((r) => r.id)).toEqual([a.id]);
  });

  it("tombstone: invisibile alle letture, fisicamente presente, purgabile", async () => {
    const a = await must(
      repo.create({ kind: "task", ref_id: uuidv7(), fire_at: T0 }),
    );
    await must(repo.softDelete(a.id));
    expect(await repo.getById(a.id)).toBeNull();
    expect(await repo.listPending(T2)).toEqual([]);
    expect(await db.reminders.get(a.id)).toBeDefined();

    const purged = await repo.purgeTombstones("2100-01-01T00:00:00.000Z");
    expect(purged.ok && purged.data).toBe(1);
    expect(await db.reminders.get(a.id)).toBeUndefined();
  });

  it("create rifiuta fire_at non ISO", async () => {
    const r = await repo.create({
      kind: "task",
      ref_id: uuidv7(),
      fire_at: "domani alle 8",
    });
    expect(!r.ok && r.error.code).toBe("validation");
  });
});

describe("LocalRemindersRepo — letture per la UI (run-03)", () => {
  it("listByRef: solo i promemoria del ref, vivi, ordinati per fire_at", async () => {
    const taskId = "00000000-0000-7000-8000-00000000000a";
    const other = "00000000-0000-7000-8000-00000000000b";
    const r2 = await must(
      repo.create({ kind: "task", ref_id: taskId, fire_at: "2026-07-10T18:00:00.000Z" }),
    );
    await must(
      repo.create({ kind: "task", ref_id: taskId, fire_at: "2026-07-10T08:00:00.000Z" }),
    );
    await must(
      repo.create({ kind: "task", ref_id: other, fire_at: "2026-07-10T09:00:00.000Z" }),
    );
    await must(repo.softDelete(r2.id));

    const list = await repo.listByRef(taskId);
    expect(list).toHaveLength(1);
    expect(list[0].fire_at).toBe("2026-07-10T08:00:00.000Z");
  });

  it("listFiredUndismissed: scattati e mai riconosciuti, più recenti prima", async () => {
    const a = await must(
      repo.create({ kind: "task", ref_id: "00000000-0000-7000-8000-000000000001", fire_at: "2026-07-10T08:00:00.000Z" }),
    );
    const b = await must(
      repo.create({ kind: "task", ref_id: "00000000-0000-7000-8000-000000000002", fire_at: "2026-07-10T09:00:00.000Z" }),
    );
    const c = await must(
      repo.create({ kind: "task", ref_id: "00000000-0000-7000-8000-000000000003", fire_at: "2026-07-10T10:00:00.000Z" }),
    );
    await must(repo.markFired(a.id, "2026-07-10T08:00:05.000Z"));
    await must(repo.markFired(b.id, "2026-07-10T09:00:05.000Z"));
    await must(repo.dismiss(b.id, "2026-07-10T09:01:00.000Z"));
    // c non è mai scattato.
    void c;

    const list = await repo.listFiredUndismissed();
    expect(list.map((r) => r.id)).toEqual([a.id]);
  });
});
