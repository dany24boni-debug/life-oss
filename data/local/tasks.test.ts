import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LifeosDb } from "../db";
import { LocalTasksRepo, taskRecurSpawnId } from "./tasks";
import type { Task } from "../schemas";
import type { Clock } from "./util";

/** Clock manuale: ogni chiamata avanza di 1s — bump di updated_at visibili. */
function testClock(startMs = Date.UTC(2026, 6, 10, 8, 0, 0)): Clock {
  let t = startMs;
  return () => new Date((t += 1000)).toISOString();
}

let counter = 0;
let db: LifeosDb;
let repo: LocalTasksRepo;

beforeEach(() => {
  db = new LifeosDb(`test-tasks-${++counter}`);
  repo = new LocalTasksRepo(db, testClock());
});

afterEach(async () => {
  await db.delete();
});

async function mustCreate(input: Parameters<LocalTasksRepo["create"]>[0]) {
  const r = await repo.create(input);
  if (!r.ok) throw new Error(`create fallita: ${r.error.message}`);
  return r.data;
}

describe("LocalTasksRepo — CRUD", () => {
  it("create riempie i default e persiste", async () => {
    const task = await mustCreate({ title: "Comprare il latte" });
    expect(task.status).toBe("open");
    expect(task.date).toBeNull();
    expect(task.tags).toEqual([]);
    expect(task.deleted_at).toBeNull();
    expect(task.created_at).toBe(task.updated_at);
    expect(await repo.getById(task.id)).toEqual(task);
  });

  it("create rifiuta input non validi con err validation", async () => {
    const r = await repo.create({ title: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("validation");
  });

  it("update applica la patch e bumpa updated_at", async () => {
    const task = await mustCreate({ title: "Bozza", date: "2026-07-10" });
    const r = await repo.update(task.id, { title: "Definitivo", time: "18:30" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.title).toBe("Definitivo");
      expect(r.data.time).toBe("18:30");
      expect(r.data.date).toBe("2026-07-10"); // campo non in patch: intatto
      expect(r.data.updated_at > task.updated_at).toBe(true);
      expect(r.data.created_at).toBe(task.created_at);
    }
  });

  it("update su id inesistente restituisce not_found", async () => {
    const r = await repo.update("00000000-0000-7000-8000-000000000000", {
      title: "x",
    });
    expect(!r.ok && r.error.code).toBe("not_found");
  });

  it("complete e uncomplete sono idempotenti e coerenti", async () => {
    const task = await mustCreate({ title: "Allenamento" });
    const done = await repo.complete(task.id);
    expect(done.ok && done.data.status).toBe("done");
    if (done.ok) {
      expect(done.data.completed_at).not.toBeNull();
      // Seconda complete: idempotente, stessa riga.
      const again = await repo.complete(task.id);
      expect(again.ok && again.data.updated_at).toBe(done.data.updated_at);
    }
    const undone = await repo.uncomplete(task.id);
    expect(undone.ok && undone.data.status).toBe("open");
    if (undone.ok) expect(undone.data.completed_at).toBeNull();
  });
});

describe("LocalTasksRepo — tombstone", () => {
  it("softDelete rende la riga invisibile a ogni lettura ma la lascia fisicamente", async () => {
    const task = await mustCreate({ title: "Da eliminare", date: "2026-07-10" });
    const r = await repo.softDelete(task.id);
    expect(r.ok).toBe(true);

    expect(await repo.getById(task.id)).toBeNull();
    expect(await repo.listByDay("2026-07-10")).toEqual([]);

    // La riga esiste ancora fisicamente, con tombstone e updated_at bumpato.
    const raw = await db.tasks.get(task.id);
    expect(raw).toBeDefined();
    expect(raw!.deleted_at).not.toBeNull();
    expect(raw!.updated_at > task.updated_at).toBe(true);
  });

  it("softDelete è idempotente; su id inesistente not_found", async () => {
    const task = await mustCreate({ title: "x" });
    await repo.softDelete(task.id);
    expect((await repo.softDelete(task.id)).ok).toBe(true);
    const r = await repo.softDelete("00000000-0000-7000-8000-000000000000");
    expect(!r.ok && r.error.code).toBe("not_found");
  });

  it("restore annulla il soft delete e bumpa updated_at (pattern undo)", async () => {
    const task = await mustCreate({ title: "Ripescabile", date: "2026-07-10" });
    await repo.softDelete(task.id);
    const deleted = await db.tasks.get(task.id);

    const r = await repo.restore(task.id);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.deleted_at).toBeNull();
      // L'undo deve vincere il LWW sul delete: updated_at più recente.
      expect(r.data.updated_at > deleted!.updated_at).toBe(true);
    }
    expect(await repo.getById(task.id)).not.toBeNull();
    expect(await repo.listByDay("2026-07-10")).toHaveLength(1);
  });

  it("restore è idempotente su righe vive; su id inesistente not_found", async () => {
    const task = await mustCreate({ title: "Viva" });
    const r = await repo.restore(task.id);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.updated_at).toBe(task.updated_at); // nessun bump
    const missing = await repo.restore("00000000-0000-7000-8000-000000000000");
    expect(!missing.ok && missing.error.code).toBe("not_found");
  });

  it("update/complete su una tombstone restituisce not_found", async () => {
    const task = await mustCreate({ title: "x" });
    await repo.softDelete(task.id);
    const u = await repo.update(task.id, { title: "y" });
    expect(!u.ok && u.error.code).toBe("not_found");
    const c = await repo.complete(task.id);
    expect(!c.ok && c.error.code).toBe("not_found");
  });

  it("purgeTombstones rimuove solo le tombstone più vecchie della soglia", async () => {
    const a = await mustCreate({ title: "vecchia" });
    const b = await mustCreate({ title: "recente" });
    const c = await mustCreate({ title: "viva" });
    await repo.softDelete(a.id); // deleted_at ≈ +4s dal clock di test
    await repo.softDelete(b.id); // deleted_at ≈ +5s

    const rawA = await db.tasks.get(a.id);
    const cutoff = new Date(
      new Date(rawA!.deleted_at!).getTime() + 500,
    ).toISOString(); // tra le due tombstone

    const purged = await repo.purgeTombstones(cutoff);
    expect(purged.ok && purged.data).toBe(1);
    expect(await db.tasks.get(a.id)).toBeUndefined(); // rimossa fisicamente
    expect(await db.tasks.get(b.id)).toBeDefined(); // tombstone recente: resta
    expect(await repo.getById(c.id)).not.toBeNull(); // riga viva: intatta
  });
});

describe("LocalTasksRepo — liste", () => {
  it("listByDay filtra il giorno, esclude tombstone, ordina per sort_order", async () => {
    const t1 = await mustCreate({ title: "primo", date: "2026-07-10" });
    const t2 = await mustCreate({ title: "secondo", date: "2026-07-10" });
    await mustCreate({ title: "altro giorno", date: "2026-07-11" });
    const t4 = await mustCreate({ title: "cancellato", date: "2026-07-10" });
    await repo.softDelete(t4.id);

    const day = await repo.listByDay("2026-07-10");
    expect(day.map((t) => t.id)).toEqual([t1.id, t2.id]);
  });

  it("listOverdue: solo aperti con data passata", async () => {
    const past = await mustCreate({ title: "ieri", date: "2026-07-09" });
    const pastDone = await mustCreate({ title: "ieri fatto", date: "2026-07-09" });
    await repo.complete(pastDone.id);
    await mustCreate({ title: "oggi", date: "2026-07-10" });
    await mustCreate({ title: "inbox" }); // senza data: mai in ritardo

    const overdue = await repo.listOverdue("2026-07-10");
    expect(overdue.map((t) => t.id)).toEqual([past.id]);
  });

  it("listInbox: solo task senza data", async () => {
    const inbox = await mustCreate({ title: "senza data" });
    await mustCreate({ title: "con data", date: "2026-07-10" });
    expect((await repo.listInbox()).map((t) => t.id)).toEqual([inbox.id]);
  });

  it("listUpcoming: range inclusivo ordinato per giorno", async () => {
    const b = await mustCreate({ title: "b", date: "2026-07-12" });
    const a = await mustCreate({ title: "a", date: "2026-07-11" });
    await mustCreate({ title: "fuori", date: "2026-07-20" });
    const up = await repo.listUpcoming("2026-07-11", "2026-07-13");
    expect(up.map((t) => t.id)).toEqual([a.id, b.id]);
  });

  it("listDone: più recenti prima, paginazione a cursore", async () => {
    const t1 = await mustCreate({ title: "uno" });
    const t2 = await mustCreate({ title: "due" });
    const t3 = await mustCreate({ title: "tre" });
    await repo.complete(t1.id);
    await repo.complete(t2.id);
    await repo.complete(t3.id);

    const page1 = await repo.listDone({ limit: 2 });
    expect(page1.map((t) => t.id)).toEqual([t3.id, t2.id]);
    const page2 = await repo.listDone({
      limit: 2,
      before: page1[1].completed_at!,
    });
    expect(page2.map((t) => t.id)).toEqual([t1.id]);
  });
});

describe("LocalTasksRepo — reorder", () => {
  it("assegna sort_order = indice e bumpa updated_at solo su chi cambia", async () => {
    const a = await mustCreate({ title: "a", date: "2026-07-10" });
    const b = await mustCreate({ title: "b", date: "2026-07-10" });
    const c = await mustCreate({ title: "c", date: "2026-07-10" });

    const r = await repo.reorder([c.id, a.id, b.id]);
    expect(r.ok).toBe(true);

    const day = await repo.listByDay("2026-07-10");
    expect(day.map((t) => t.title)).toEqual(["c", "a", "b"]);

    const rawC = (await db.tasks.get(c.id)) as Task;
    expect(rawC.updated_at > c.updated_at).toBe(true);
  });

  it("id ignoti o tombstone vengono saltati senza errore", async () => {
    const a = await mustCreate({ title: "a" });
    const ghost = "00000000-0000-7000-8000-000000000000";
    const r = await repo.reorder([ghost, a.id]);
    expect(r.ok).toBe(true);
    const raw = (await db.tasks.get(a.id)) as Task;
    expect(raw.sort_order).toBe(1);
  });

  it("i nuovi task entrano in coda (sort_order crescente)", async () => {
    const a = await mustCreate({ title: "a" });
    const b = await mustCreate({ title: "b" });
    expect(b.sort_order).toBeGreaterThan(a.sort_order);
  });
});

describe("LocalTasksRepo — ricorrenze (run-09)", () => {
  it("completare un ricorrente genera la prossima occorrenza (id derivato)", async () => {
    const task = await mustCreate({
      title: "Palestra",
      date: "2026-07-13", // lunedì
      time: "18:00",
      recurrence: { freq: "weekly", weekdays: [1, 4] },
    });
    const r = await repo.complete(task.id, { today: "2026-07-13" });
    expect(r.ok).toBe(true);

    const spawnId = await taskRecurSpawnId(task.id);
    const spawn = await repo.getById(spawnId);
    expect(spawn).not.toBeNull();
    expect(spawn?.date).toBe("2026-07-16"); // giovedì
    expect(spawn?.time).toBe("18:00");
    expect(spawn?.status).toBe("open");
    expect(spawn?.recurrence).toEqual({ freq: "weekly", weekdays: [1, 4] });

    // Idempotente: ri-completare non genera doppioni né tocca lo spawn.
    const before = (await db.tasks.get(spawnId)) as Task;
    await repo.complete(task.id, { today: "2026-07-13" });
    expect(await db.tasks.count()).toBe(2);
    expect((await db.tasks.get(spawnId)) as Task).toEqual(before);
  });

  it("un ricorrente IN RITARDO completato oggi riparte da oggi", async () => {
    const task = await mustCreate({
      title: "Ogni giorno",
      date: "2026-07-01", // molto in ritardo
      recurrence: { freq: "daily" },
    });
    await repo.complete(task.id, { today: "2026-07-13" });
    const spawn = await repo.getById(await taskRecurSpawnId(task.id));
    // max(oggi, data) = oggi → domani, non il 2 luglio.
    expect(spawn?.date).toBe("2026-07-14");
  });

  it("uncomplete tombstona lo spawn; ri-completare lo rianima (stessa PK)", async () => {
    const task = await mustCreate({
      title: "Lettura",
      date: "2026-07-13",
      recurrence: { freq: "daily" },
    });
    await repo.complete(task.id, { today: "2026-07-13" });
    const spawnId = await taskRecurSpawnId(task.id);
    expect(await repo.getById(spawnId)).not.toBeNull();

    await repo.uncomplete(task.id);
    expect(await repo.getById(spawnId)).toBeNull(); // tombstone, non purge
    expect((await db.tasks.get(spawnId))?.deleted_at).not.toBeNull();

    await repo.complete(task.id, { today: "2026-07-13" });
    const revived = await repo.getById(spawnId);
    expect(revived).not.toBeNull();
    expect(revived?.date).toBe("2026-07-14");
    expect(await db.tasks.count()).toBe(2); // mai una terza riga
  });

  it("uncomplete NON tocca uno spawn già completato dall'utente", async () => {
    const task = await mustCreate({
      title: "Abitudine",
      date: "2026-07-13",
      recurrence: { freq: "daily" },
    });
    await repo.complete(task.id, { today: "2026-07-13" });
    const spawnId = await taskRecurSpawnId(task.id);
    await repo.complete(spawnId, { today: "2026-07-14" });
    await repo.uncomplete(task.id);
    // Lo spawn è "done", non più intonso: resta vivo.
    expect((await db.tasks.get(spawnId))?.deleted_at).toBeNull();
  });

  it("un task normale non genera nulla; la regola si normalizza", async () => {
    const plain = await mustCreate({ title: "Una volta", date: "2026-07-13" });
    await repo.complete(plain.id, { today: "2026-07-13" });
    expect(await db.tasks.count()).toBe(1);

    const norm = await mustCreate({
      title: "Tutti i giorni",
      recurrence: { freq: "weekly", weekdays: [7, 1, 2, 3, 4, 5, 6] },
    });
    expect(norm.recurrence).toEqual({ freq: "daily" });
  });
});
