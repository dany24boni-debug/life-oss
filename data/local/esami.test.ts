import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { LifeosDb } from "../db";
import type { Result } from "../result";
import { LocalEsamiRepo } from "./esami";

let counter = 0;
const dbs: LifeosDb[] = [];

function makeRepo(): { repo: LocalEsamiRepo; db: LifeosDb } {
  const db = new LifeosDb(`esami-test-${++counter}`);
  dbs.push(db);
  return { repo: new LocalEsamiRepo(db), db };
}

function must<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`mutazione fallita: ${r.error.message}`);
  return r.data;
}

afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete();
});

describe("LocalEsamiRepo — CRUD", () => {
  it("create con soli titolo+data: capitoli a 0, note null", async () => {
    const { repo } = makeRepo();
    const exam = must(
      await repo.create({ title: "Storia moderna", date: "2026-09-10" }),
    );
    expect(exam.total_chapters).toBe(0);
    expect(exam.completed_chapters).toBe(0);
    expect(exam.notes).toBeNull();
    expect(exam.deleted_at).toBeNull();
    expect(await repo.getById(exam.id)).toEqual(exam);
  });

  it("update patcha i campi e bump updated_at", async () => {
    const { repo } = makeRepo();
    const exam = must(
      await repo.create({
        title: "Analisi 1",
        date: "2026-09-01",
        total_chapters: 12,
      }),
    );
    const next = must(
      await repo.update(exam.id, { completed_chapters: 5, notes: "Sbatti" }),
    );
    expect(next.completed_chapters).toBe(5);
    expect(next.notes).toBe("Sbatti");
    expect(next.updated_at > exam.updated_at).toBe(true);
  });

  it("invariante: completati oltre il totale → clamp al totale", async () => {
    const { repo } = makeRepo();
    const exam = must(
      await repo.create({
        title: "Fisica",
        date: "2026-09-01",
        total_chapters: 3,
      }),
    );
    const overshoot = must(
      await repo.update(exam.id, { completed_chapters: 9 }),
    );
    expect(overshoot.completed_chapters).toBe(3);

    // Abbassare il totale trascina giù i completati (mai errore).
    const lowered = must(await repo.update(exam.id, { total_chapters: 2 }));
    expect(lowered.total_chapters).toBe(2);
    expect(lowered.completed_chapters).toBe(2);
  });

  it("softDelete + restore: tombstone e undo, liste sempre pulite", async () => {
    const { repo } = makeRepo();
    const a = must(await repo.create({ title: "A", date: "2026-09-01" }));
    const b = must(await repo.create({ title: "B", date: "2026-08-01" }));

    must(await repo.softDelete(a.id));
    expect(await repo.getById(a.id)).toBeNull();
    expect((await repo.listAll()).map((e) => e.id)).toEqual([b.id]);

    const back = must(await repo.restore(a.id));
    expect(back.deleted_at).toBeNull();
    // listAll: per data crescente.
    expect((await repo.listAll()).map((e) => e.id)).toEqual([b.id, a.id]);
  });

  it("create rifiuta input malformati (titolo vuoto)", async () => {
    const { repo } = makeRepo();
    const r = await repo.create({ title: "   ", date: "2026-09-01" });
    expect(r.ok).toBe(false);
  });
});
